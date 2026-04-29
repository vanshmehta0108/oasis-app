import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyzeIngredients } from "@/lib/scoring";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";
import { checkRateLimit } from "@/lib/rateLimit";
import type { Product } from "@/lib/database.types";

// ── Validation ──────────────────────────────────────────────────────────────────

const ScanRequest = z.object({
  barcode: z.string().min(1, "Barcode is required").max(64),
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

const corsOpts = { methods: ["POST", "OPTIONS"] as const };

function errorResponse(req: NextRequest, message: string, status: number, details?: string): NextResponse {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status, headers: corsHeadersFor(req, corsOpts) }
  );
}

// ── Handler ─────────────────────────────────────────────────────────────────────

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return corsPreflight(req, corsOpts);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cors = corsHeadersFor(req, corsOpts);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`scan:${ip}`, { capacity: 60, refillPerMin: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limit", retryAfter: rl.retryAfter },
      { status: 429, headers: { ...cors, "Retry-After": String(rl.retryAfter) } },
    );
  }
  try {
    const body = await req.json();
    const parsed = ScanRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse(req, "Invalid request", 400, firstIssue?.message);
    }

    const { barcode } = parsed.data;

    const { data: rawProduct } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", barcode)
      .single();

    const product = rawProduct as Product | null;

    if (!product) {
      return errorResponse(req, "Product not found", 404, `No product found for barcode: ${barcode}`);
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
        { headers: cors }
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
        { headers: cors }
      );
    }

    // No ingredients — can't analyze
    return NextResponse.json(
      { found: true, needs_ingredients: true, product },
      { headers: cors }
    );
  } catch (error) {
    console.error("Scan error:", error instanceof Error ? error.message : String(error));
    return errorResponse(req, "Scan failed", 500);
  }
}
