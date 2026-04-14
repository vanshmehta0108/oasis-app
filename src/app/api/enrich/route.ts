export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichByName, enrichByBarcode, batchEnrich } from "@/lib/webEnrich";

// ── Validation ──────────────────────────────────────────────────────────────────

const EnrichRequest = z.object({
  name: z.string().min(1).optional(),
  brand: z.string().optional(),
  barcode: z.string().min(1).optional(),
  batch: z
    .array(z.object({ name: z.string().min(1), brand: z.string().optional() }))
    .max(10, "Maximum 10 products per batch")
    .optional(),
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

// ── Handler ─────────────────────────────────────────────────────────────────────
// This endpoint ONLY finds products and their ingredients.
// AI safety analysis happens separately via /api/analyze (called by the product page).
// This keeps each Edge function call well under the 30s timeout.

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const parsed = EnrichRequest.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Invalid request", 400, parsed.error.issues[0]?.message);
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
        { headers: corsHeaders() }
      );
    }

    // ── Single product ──────────────────────────────────────────────────────
    if (!name && !barcode) {
      return errorResponse("Provide 'name', 'barcode', or 'batch' array", 400);
    }

    const product = barcode
      ? await enrichByBarcode(barcode)
      : await enrichByName(name!, brand);

    if (!product || product.ingredients.length === 0) {
      return NextResponse.json(
        { found: false, message: `Could not find product details for: ${name || barcode}`, product: product || null },
        { status: 404, headers: corsHeaders() }
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
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Enrich error:", error);
    return errorResponse(error instanceof Error ? error.message : "Enrichment failed", 500);
  }
}
