export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { masterLookup } from "@/lib/master";
import { supabase } from "@/lib/supabase";
import { analyzeIngredients, analyzeLabel, translateAnalysis } from "@/lib/scoring";
import { checkRateLimit } from "@/lib/rateLimit";
import { log } from "@/lib/log";
import type { Product, ProductInsert, ProductCategory } from "@/lib/database.types";

// ── Validation ──────────────────────────────────────────────────────────────────

const AnalyzeRequest = z.object({
  barcode: z.string().min(1, "Barcode cannot be empty").optional(),
  name: z.string().optional(),
  brand: z.string().optional(),
  ingredients: z.array(z.string().min(1)).min(1, "Ingredients list cannot be empty").optional(),
  image: z.string().min(100, "Image data is too short to be valid").optional(),
  category: z.string().default("food"),
  lang: z.enum(["en", "hi"]).default("en"),
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function errorResponse(message: string, status: number, details?: string): NextResponse {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status, headers: corsHeaders() }
  );
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// ── Handler ─────────────────────────────────────────────────────────────────────

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  // Image requests are ~100x more expensive (Gemini vision call); stricter bucket.
  const started = Date.now();

  try {
    const body = await req.json();
    const parsed = AnalyzeRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse("Invalid request", 400, firstIssue?.message);
    }

    const { barcode, name: productName, brand: productBrand, ingredients, image, category, lang } = parsed.data;

    // Rate limit AFTER parse so malformed bodies don't burn tokens, but
    // BEFORE the expensive Gemini call. Image calls get a tighter bucket.
    const isImage = !!image;
    const rl = checkRateLimit(
      `analyze:${isImage ? "img" : "txt"}:${ip}`,
      isImage ? { capacity: 6, refillPerMin: 6 } : { capacity: 30, refillPerMin: 30 },
    );
    if (!rl.ok) {
      log.warn("analyze.rate_limited", { ip, isImage, retryAfter: rl.retryAfter });
      return NextResponse.json(
        { error: "Rate limit exceeded", details: `Too many requests. Retry in ${rl.retryAfter}s.`, retryAfter: rl.retryAfter },
        { status: 429, headers: { ...corsHeaders(), "Retry-After": String(rl.retryAfter) } },
      );
    }

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
      try {
        labelData = await analyzeLabel(image);
      } catch (err) {
        console.error("Label extraction failed:", err);
        return errorResponse(
          "Couldn't read the label",
          422,
          "The image was too blurry or dark to extract ingredients. Try better lighting or a closer shot."
        );
      }
      finalIngredients = labelData.ingredients;
    }

    if (finalIngredients.length === 0) {
      return errorResponse(
        "No ingredients found",
        400,
        image
          ? "Couldn't find an ingredient list on this label. Try framing the INGREDIENTS section directly."
          : "Provide an ingredients list or a clearer label image."
      );
    }

    let analysis;
    try {
      analysis = await analyzeIngredients(finalIngredients, category, labelData?.fssai_license ?? null);
    } catch (err) {
      log.error("analyze.ingredients_fail", { ip, err: err instanceof Error ? err.message : String(err) });
      const message = err instanceof Error ? err.message : "Analysis failed";
      const isRateLimit = /rate|quota|429|resource_exhausted/i.test(message);
      return errorResponse(
        isRateLimit ? "Analysis temporarily unavailable" : "Analysis failed",
        isRateLimit ? 429 : 500,
        isRateLimit ? "Our AI is rate-limited right now. Please retry in a minute." : message
      );
    }

    // Optional localization — happens AFTER persisting the canonical English
    // version so the DB cache always holds the source-of-truth English
    // analysis. Hindi output is per-request, not stored.
    let localizedAnalysis = analysis;
    if (lang === "hi") {
      try {
        localizedAnalysis = await translateAnalysis(analysis, "hi");
      } catch (err) {
        log.warn("analyze.translate_fail", { ip, lang, err: err instanceof Error ? err.message : String(err) });
        // Fall back to English rather than 500 — user still gets a result.
      }
    }

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

      log.info("analyze.ok", { ip, source: "analyzed", barcode, isImage, lang, durationMs: Date.now() - started, score: analysis.score });
      return NextResponse.json(
        {
          source: "analyzed",
          product: upserted as Product | null,
          analysis: localizedAnalysis,
          label_extraction: labelData,
          lang,
        },
        { headers: corsHeaders() }
      );
    }

    log.info("analyze.ok", { ip, source: "analyzed", isImage, lang, durationMs: Date.now() - started, score: analysis.score });
    return NextResponse.json(
      { source: "analyzed", analysis: localizedAnalysis, label_extraction: labelData, lang },
      { headers: corsHeaders() }
    );
  } catch (error) {
    log.error("analyze.fail", { ip, err: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Analysis failed";
    return errorResponse(message, 500);
  }
}
