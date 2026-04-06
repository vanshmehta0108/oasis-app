import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyzeIngredients } from "@/lib/scoring";
import type { Product } from "@/lib/database.types";

// ── Validation ──────────────────────────────────────────────────────────────────

const ScanRequest = z.object({
  barcode: z.string().min(1, "Barcode is required"),
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Remaining": "59",
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
    const parsed = ScanRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse("Invalid request", 400, firstIssue?.message);
    }

    const { barcode } = parsed.data;

    const { data: rawProduct } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", barcode)
      .single();

    const product = rawProduct as Product | null;

    if (!product) {
      return errorResponse("Product not found", 404, `No product found for barcode: ${barcode}`);
    }

    // Increment scan count
    const scanUpdate = { scan_count: product.scan_count + 1 };
    await supabase
      .from("products")
      // @ts-expect-error Supabase generic typing mismatch
      .update(scanUpdate)
      .eq("id", product.id);

    // Already analyzed — return immediately
    if (product.analysis && product.safety_score !== null) {
      return NextResponse.json(
        {
          found: true,
          product: { ...product, scan_count: product.scan_count + 1 },
          analysis: product.analysis,
        },
        { headers: corsHeaders() }
      );
    }

    // Product exists but no analysis — run it now if we have ingredients
    if (product.ingredients.length > 0) {
      const analysis = await analyzeIngredients(product.ingredients, product.category);

      const analysisUpdate = {
        safety_score: analysis.score,
        score_grade: analysis.grade,
        analysis: analysis as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      };
      await supabase
        .from("products")
        // @ts-expect-error Supabase generic typing mismatch
        .update(analysisUpdate)
        .eq("id", product.id);

      return NextResponse.json(
        {
          found: true,
          product: {
            ...product,
            safety_score: analysis.score,
            score_grade: analysis.grade,
            scan_count: product.scan_count + 1,
          },
          analysis,
        },
        { headers: corsHeaders() }
      );
    }

    // No ingredients — can't analyze
    return NextResponse.json(
      { found: true, needs_ingredients: true, product },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Scan error:", error);
    const message = error instanceof Error ? error.message : "Scan failed";
    return errorResponse(message, 500);
  }
}
