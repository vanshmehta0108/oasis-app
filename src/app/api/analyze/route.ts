export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { masterLookup } from "@/lib/master";
import { supabase } from "@/lib/supabase";
import { analyzeIngredients, analyzeLabel } from "@/lib/scoring";
import type { Product, ProductInsert, ProductCategory } from "@/lib/database.types";

// ── Validation ──────────────────────────────────────────────────────────────────

const AnalyzeRequest = z.object({
  barcode: z.string().min(1, "Barcode cannot be empty").optional(),
  name: z.string().optional(),
  brand: z.string().optional(),
  ingredients: z.array(z.string().min(1)).min(1, "Ingredients list cannot be empty").optional(),
  image: z.string().min(100, "Image data is too short to be valid").optional(),
  category: z.string().default("food"),
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-RateLimit-Limit": "30",
    "X-RateLimit-Remaining": "29",
    "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
  };
}

function errorResponse(message: string, status: number, details?: string): NextResponse {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status, headers: corsHeaders() }
  );
}

// ── Handler ─────────────────────────────────────────────────────────────────────

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = AnalyzeRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse("Invalid request", 400, firstIssue?.message);
    }

    const { barcode, name: productName, brand: productBrand, ingredients, image, category } = parsed.data;

    if (!ingredients && !image && !barcode) {
      return errorResponse("Provide at least one of: barcode, ingredients, or image", 400);
    }

    // Check cache if barcode provided — master sheet first (zero cost), then DB
    if (barcode) {
      const masterProduct = masterLookup(barcode);
      if (masterProduct?.analysis) {
        return NextResponse.json(
          { source: "master", product: { barcode, ...masterProduct }, analysis: masterProduct.analysis },
          { headers: corsHeaders() }
        );
      }

      const { data: existing } = await supabase
        .from("products")
        .select("*")
        .eq("barcode", barcode)
        .single();

      const product = existing as Product | null;
      if (product?.analysis) {
        return NextResponse.json(
          { source: "cached", product, analysis: product.analysis },
          { headers: corsHeaders() }
        );
      }
    }

    // Extract ingredients from image if needed
    let finalIngredients = ingredients ?? [];
    let labelData = null;

    if (image) {
      labelData = await analyzeLabel(image);
      finalIngredients = labelData.ingredients;
    }

    if (finalIngredients.length === 0) {
      return errorResponse(
        "No ingredients found",
        400,
        "Provide an ingredients list or a clearer label image."
      );
    }

    const analysis = await analyzeIngredients(finalIngredients, category, labelData?.fssai_license ?? null);

    // Store result if we have a barcode
    if (barcode) {
      const productData: ProductInsert = {
        barcode,
        name: productName || labelData?.product_name || "Unknown Product",
        brand: productBrand || labelData?.brand || "Unknown Brand",
        category: category as ProductCategory,
        ingredients: finalIngredients,
        nutritional_info: labelData?.nutritional_info ?? {},
        safety_score: analysis.score,
        score_grade: analysis.grade,
        fssai_license: labelData?.fssai_license ?? null,
        analysis: analysis as unknown as Record<string, unknown>,
      };

      // Remap healthier_tip → healthier_alternative so product page renders it
      const storedAnalysis = {
        ...analysis,
        healthier_alternative: (analysis as unknown as Record<string, string>).healthier_tip,
      };
      productData.analysis = storedAnalysis as unknown as Record<string, unknown>;

      const { data: upserted } = await supabase
        .from("products")
        // @ts-expect-error Supabase generic typing mismatch
        .upsert(productData, { onConflict: "barcode" })
        .select()
        .single();

      return NextResponse.json(
        {
          source: "analyzed",
          product: upserted as Product | null,
          analysis,
          label_extraction: labelData,
        },
        { headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { source: "analyzed", analysis, label_extraction: labelData },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "Analysis failed";
    return errorResponse(message, 500);
  }
}
