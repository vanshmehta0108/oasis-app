export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest } from "next/server";
import { z } from "zod";
import { masterLookup } from "@/lib/master";
import { supabase } from "@/lib/supabase";
import { analyzeIngredients, analyzeLabel, translateAnalysis } from "@/lib/scoring";
import { checkRateLimit } from "@/lib/rateLimit";
import { log } from "@/lib/log";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";
import type { Product, ProductInsert, ProductCategory } from "@/lib/database.types";

// ── Validation ──────────────────────────────────────────────────────────────────

// Image size cap: 10MB base64 (~7MB raw). Larger images crash the
// serverless function with OOM and burn AI quota for unreadable photos.
const MAX_IMAGE_BYTES = 10_000_000;

const AnalyzeRequest = z.object({
  barcode: z.string().min(1, "Barcode cannot be empty").max(64).optional(),
  name: z.string().max(200).optional(),
  brand: z.string().max(100).optional(),
  ingredients: z.array(z.string().min(1).max(200)).min(1, "Ingredients list cannot be empty").max(150).optional(),
  image: z.string().min(100, "Image data is too short to be valid").max(MAX_IMAGE_BYTES, "Image too large — keep under 7MB").optional(),
  category: z.string().max(30).default("food"),
  lang: z.enum(["en", "hi"]).default("en"),
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

// Returns true if the extracted text looks like a nutrition facts panel rather
// than an ingredient list. Nutrition panels contain numeric values, units, and
// specific keywords that never appear in a real ingredient list.
function looksLikeNutritionPanel(ingredients: string[]): boolean {
  if (ingredients.length === 0) return false;
  const combined = ingredients.join(" ").toLowerCase();
  const nutritionKeywords = /serving|kcal|kj|\brda\b|nutritional|energy|carbohydrate|cholesterol|sodium|potassium|calcium|magnesium|protein|per\s*\d+\s*(ml|g)|uom|approx|values|facts|daily\s+value|\d{2,}\.\d+/;
  return (
    nutritionKeywords.test(combined) ||
    ingredients.some((s) => s.trim().length > 80) ||
    // If most tokens are numbers/units, it's a nutrition panel
    ingredients.filter((s) => /^\d/.test(s.trim())).length > ingredients.length / 3
  );
}

const corsOpts = { methods: ["POST", "OPTIONS"] as const };

function sseHeaders(req: NextRequest): Record<string, string> {
  return {
    ...corsHeadersFor(req, corsOpts) as Record<string, string>,
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
  };
}

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function makeStream(
  req: NextRequest,
  handler: (send: (data: object) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await handler(send);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: sseHeaders(req) });
}

function jsonError(req: NextRequest, message: string, status: number, details?: string): Response {
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    { status, headers: { "Content-Type": "application/json", ...corsHeadersFor(req, corsOpts) } }
  );
}

// ── Handler ─────────────────────────────────────────────────────────────────────

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return corsPreflight(req, corsOpts);
}

export async function POST(req: NextRequest): Promise<Response> {
  const ip = clientIp(req);
  const started = Date.now();

  // Hard cap incoming body before parsing — prevents OOM on giant payloads.
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_IMAGE_BYTES + 1024) {
    return jsonError(req, "Payload too large", 413, `Image must be under 7MB`);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(req, "Invalid JSON body", 400);
  }

  const parsed = AnalyzeRequest.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return jsonError(req, "Invalid request", 400, firstIssue?.message);
  }

  const { barcode, name: productName, brand: productBrand, ingredients, image, category, lang } = parsed.data;

  const isImage = !!image;
  const rl = checkRateLimit(
    `analyze:${isImage ? "img" : "txt"}:${ip}`,
    isImage ? { capacity: 6, refillPerMin: 6 } : { capacity: 30, refillPerMin: 30 },
  );
  if (!rl.ok) {
    log.warn("analyze.rate_limited", { ip, isImage, retryAfter: rl.retryAfter });
    return jsonError(req,
      "Rate limit exceeded",
      429,
      `Too many requests. Retry in ${rl.retryAfter}s.`
    );
  }

  if (!ingredients && !image && !barcode) {
    return jsonError(req, "Provide at least one of: barcode, ingredients, or image", 400);
  }

  return makeStream(req, async (send) => {
    send({ type: "progress", step: "cache", message: "Checking database…" });

    // Cache check — master sheet (zero cost, instant)
    if (barcode) {
      const masterProduct = masterLookup(barcode);
      if (masterProduct?.analysis) {
        send({ type: "complete", source: "master", product: { barcode, ...masterProduct }, analysis: masterProduct.analysis, lang });
        return;
      }

      const { data: existing } = await supabase
        .from("products")
        .select("*")
        .eq("barcode", barcode)
        .single();

      const product = existing as Product | null;
      // Skip cache when an image was submitted — user is explicitly providing a new
      // label to analyze, so we should always re-run (prevents a stale nutrition-facts
      // scan from blocking a correct ingredient-label scan of the same barcode).
      if (product?.analysis && !image) {
        send({ type: "complete", source: "cached", product, analysis: product.analysis, lang });
        return;
      }
    }

    // Extract ingredients from image if needed
    let finalIngredients = ingredients ?? [];
    let labelData = null;

    if (image) {
      send({ type: "progress", step: "ocr", message: "Reading ingredient label…" });
      try {
        labelData = await analyzeLabel(image);
      } catch (err) {
        log.error("analyze.label_fail", { ip, err: err instanceof Error ? err.message : String(err) });
        send({ type: "error", error: "Couldn't read the label — try better lighting or a closer shot." });
        return;
      }
      finalIngredients = labelData.ingredients;

      // Detect nutrition facts panel instead of ingredient list
      if (looksLikeNutritionPanel(finalIngredients)) {
        send({
          type: "error",
          error: "That looks like the Nutrition Facts panel, not the ingredient list. Please scan the INGREDIENTS section — it's usually printed in smaller text below or beside the nutrition panel.",
        });
        return;
      }
    }

    if (finalIngredients.length === 0) {
      send({
        type: "error",
        error: image
          ? "Couldn't find an ingredient list in this photo. Frame the INGREDIENTS section directly and ensure the text is clearly visible."
          : "No ingredients found. Provide an ingredients list or a clearer label image.",
      });
      return;
    }

    // AI analysis
    send({ type: "progress", step: "ai", message: `Analysing ${finalIngredients.length} ingredient${finalIngredients.length === 1 ? "" : "s"}…` });

    let analysis;
    try {
      analysis = await analyzeIngredients(finalIngredients, category);
    } catch (err) {
      log.error("analyze.ingredients_fail", { ip, err: err instanceof Error ? err.message : String(err) });
      const message = err instanceof Error ? err.message : "Analysis failed";
      const isRateLimit = /rate|quota|429|resource_exhausted/i.test(message);
      send({
        type: "error",
        error: isRateLimit
          ? "AI temporarily unavailable — our capacity is rate-limited. Retry in a minute."
          : "Analysis failed — please try again.",
      });
      return;
    }

    // Optional localization — canonical English is persisted to DB; Hindi is per-request
    let localizedAnalysis = analysis;
    if (lang === "hi") {
      send({ type: "progress", step: "translate", message: "Translating to Hindi…" });
      try {
        localizedAnalysis = await translateAnalysis(analysis, "hi");
      } catch (err) {
        log.warn("analyze.translate_fail", { ip, lang, err: err instanceof Error ? err.message : String(err) });
        // Fall back to English
      }
    }

    // Persist to DB if we have a barcode
    let upserted: Product | null = null;
    if (barcode) {
      const storedAnalysis = {
        ...analysis,
        healthier_alternative: (analysis as unknown as Record<string, string>).healthier_tip,
      };

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
        analysis: storedAnalysis as unknown as Record<string, unknown>,
      };

      const { data } = await supabase
        .from("products")
        // @ts-expect-error Supabase generic typing mismatch
        .upsert(productData, { onConflict: "barcode" })
        .select()
        .single();

      upserted = data as Product | null;
    }

    log.info("analyze.ok", { ip, source: "analyzed", barcode, isImage, lang, durationMs: Date.now() - started, score: analysis.score });

    send({
      type: "complete",
      source: "analyzed",
      product: upserted,
      analysis: localizedAnalysis,
      label_extraction: labelData,
      lang,
    });
  });
}
