import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { masterLookup } from "@/lib/master";
import { getProductByBarcode } from "@/lib/db";
import { fetchProductByBarcode } from "@/lib/openfoodfacts";
import { enrichByBarcode } from "@/lib/webEnrich";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";

// ── Validation ──────────────────────────────────────────────────────────────────

const LookupRequest = z.object({
  barcode: z.string().min(1, "Barcode is required").max(64, "Barcode too long"),
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
  try {
    const body = await req.json();
    const parsed = LookupRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse(req, "Invalid request", 400, firstIssue?.message);
    }

    const { barcode } = parsed.data;

    // 0. Check static master sheet first (bundled at build, zero cost)
    const masterProduct = masterLookup(barcode);
    if (masterProduct && masterProduct.safety_score !== null) {
      return NextResponse.json(
        {
          found: true,
          source: "master" as const,
          product: {
            id: barcode,
            barcode,
            name: masterProduct.name,
            brand: masterProduct.brand,
            category: masterProduct.category,
            ingredients: masterProduct.ingredients,
            safety_score: masterProduct.safety_score,
            grade: masterProduct.score_grade,
            image_url: masterProduct.image_url,
            analysis: masterProduct.analysis,
          },
          needs_analysis: false,
        },
        { headers: cors }
      );
    }

    // 1. Check Supabase database
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
        { headers: cors }
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
        { headers: cors }
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
        { headers: cors }
      );
    }

    // 4. Not found anywhere
    return errorResponse(req,
      "Product not found",
      404,
      `No product found for barcode: ${barcode}`
    );
  } catch (error) {
    console.error("Lookup error:", error instanceof Error ? error.message : String(error));
    const message = error instanceof Error ? error.message : "Lookup failed";
    return errorResponse(req, message, 500);
  }
}
