export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProductByBarcode } from "@/lib/db";
import { fetchProductByBarcode } from "@/lib/openfoodfacts";
import { enrichByBarcode } from "@/lib/webEnrich";

// ── Validation ──────────────────────────────────────────────────────────────────

const LookupRequest = z.object({
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
    const parsed = LookupRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse("Invalid request", 400, firstIssue?.message);
    }

    const { barcode } = parsed.data;

    // 1. Check Supabase database first
    const dbProduct = await getProductByBarcode(barcode);

    if (dbProduct) {
      return NextResponse.json(
        {
          found: true,
          source: "database" as const,
          product: {
            id: dbProduct.barcode,
            barcode: dbProduct.barcode,
            name: dbProduct.name,
            brand: dbProduct.brand,
            category: dbProduct.category,
            ingredients: dbProduct.ingredients,
            safety_score: dbProduct.safety_score,
            grade: dbProduct.score_grade,
            image_url: dbProduct.image_url,
            analysis: dbProduct.analysis,
          },
          needs_analysis: !dbProduct.analysis,
        },
        { headers: corsHeaders() }
      );
    }

    // 2. Try Open Food Facts
    const offProduct = await fetchProductByBarcode(barcode);

    if (offProduct) {
      return NextResponse.json(
        {
          found: true,
          source: "openfoodfacts" as const,
          product: {
            id: offProduct.id,
            barcode: offProduct.barcode,
            name: offProduct.name,
            brand: offProduct.brand,
            category: offProduct.category,
            ingredients: offProduct.ingredients,
            image_url: offProduct.image_url,
          },
          needs_analysis: true,
        },
        { headers: corsHeaders() }
      );
    }

    // 3. Try Brave Search + AI extraction as last resort
    const enriched = await enrichByBarcode(barcode);

    if (enriched && enriched.ingredients.length > 0) {
      return NextResponse.json(
        {
          found: true,
          source: "web" as const,
          product: {
            id: `web-${barcode}`,
            barcode,
            name: enriched.name,
            brand: enriched.brand,
            category: enriched.category,
            ingredients: enriched.ingredients,
            image_url: undefined,
          },
          needs_analysis: true,
          confidence: enriched.confidence,
          sources: enriched.source_urls,
        },
        { headers: corsHeaders() }
      );
    }

    // 4. Not found anywhere
    return errorResponse(
      "Product not found",
      404,
      `No product found for barcode: ${barcode}`
    );
  } catch (error) {
    console.error("Lookup error:", error);
    const message = error instanceof Error ? error.message : "Lookup failed";
    return errorResponse(message, 500);
  }
}
