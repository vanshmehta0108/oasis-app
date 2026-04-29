export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichByName, enrichByBarcode, batchEnrich } from "@/lib/webEnrich";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";

// ── Validation ──────────────────────────────────────────────────────────────────

const EnrichRequest = z.object({
  name: z.string().min(1).max(200).optional(),
  brand: z.string().max(100).optional(),
  barcode: z.string().min(1).max(64).optional(),
  batch: z
    .array(z.object({ name: z.string().min(1).max(200), brand: z.string().max(100).optional() }))
    .max(10, "Maximum 10 products per batch")
    .optional(),
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
// This endpoint ONLY finds products and their ingredients.
// AI safety analysis happens separately via /api/analyze (called by the product page).
// This keeps each Edge function call well under the 30s timeout.

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return corsPreflight(req, corsOpts);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cors = corsHeadersFor(req, corsOpts);
  try {
    const body = await req.json();
    const parsed = EnrichRequest.safeParse(body);

    if (!parsed.success) {
      return errorResponse(req, "Invalid request", 400, parsed.error.issues[0]?.message);
    }

    const { name, brand, barcode, batch } = parsed.data;

    // ── Batch mode ──────────────────────────────────────────────────────────
    if (batch && batch.length > 0) {
      const enriched = await batchEnrich(batch);
      const results = enriched.map((product, i) => ({
        input: batch[i],
        found: !!product && product.ingredients.length > 0,
        product: product || null,
      }));

      return NextResponse.json(
        { mode: "batch", total: batch.length, found: results.filter((r) => r.found).length, results },
        { headers: cors }
      );
    }

    // ── Single product ──────────────────────────────────────────────────────
    if (!name && !barcode) {
      return errorResponse(req, "Provide 'name', 'barcode', or 'batch' array", 400);
    }

    const product = barcode
      ? await enrichByBarcode(barcode)
      : await enrichByName(name!, brand);

    if (!product || product.ingredients.length === 0) {
      return NextResponse.json(
        { found: false, message: `Could not find product details for: ${name || barcode}`, product: product || null },
        { status: 404, headers: cors }
      );
    }

    return NextResponse.json(
      {
        found: true,
        product: {
          id: barcode ? `web-${barcode}` : `web-${Date.now()}`,
          barcode: barcode || null,
          name: product.name,
          brand: product.brand,
          category: product.category,
          ingredients: product.ingredients,
          description: product.description,
          confidence: product.confidence,
          source_urls: product.source_urls,
        },
        needs_analysis: true,
      },
      { headers: cors }
    );
  } catch (error) {
    console.error("Enrich error:", error instanceof Error ? error.message : String(error));
    return errorResponse(req, "Enrichment failed", 500);
  }
}
