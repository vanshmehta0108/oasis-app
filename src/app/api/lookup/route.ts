import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProductByBarcode } from "@/lib/mockData";
import { fetchProductByBarcode } from "@/lib/openfoodfacts";

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

    // 1. Check local mock data first
    const localProduct = getProductByBarcode(barcode);

    if (localProduct) {
      return NextResponse.json(
        {
          found: true,
          source: "local" as const,
          product: {
            id: localProduct.id,
            barcode: localProduct.barcode,
            name: localProduct.name,
            brand: localProduct.brand,
            category: localProduct.category,
            ingredients: localProduct.ingredients,
            safety_score: localProduct.safety_score,
            grade: localProduct.grade,
            image_url: localProduct.image_url,
            analysis: localProduct.analysis,
          },
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

    // 3. Not found anywhere
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
