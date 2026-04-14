import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichByName, enrichByBarcode, batchEnrich } from "@/lib/webEnrich";
import { analyzeIngredients } from "@/lib/scoring";

// ── Validation ──────────────────────────────────────────────────────────────────

const EnrichRequest = z.object({
  // Single product lookup
  name: z.string().min(1).optional(),
  brand: z.string().optional(),
  barcode: z.string().min(1).optional(),

  // Batch mode: array of {name, brand?}
  batch: z
    .array(
      z.object({
        name: z.string().min(1),
        brand: z.string().optional(),
      })
    )
    .max(10, "Maximum 10 products per batch")
    .optional(),

  // Whether to also run AI safety analysis on found products
  analyze: z.boolean().default(true),
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function errorResponse(
  message: string,
  status: number,
  details?: string
): NextResponse {
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
    const parsed = EnrichRequest.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return errorResponse("Invalid request", 400, firstIssue?.message);
    }

    const { name, brand, barcode, batch, analyze } = parsed.data;

    // ── Batch mode ──────────────────────────────────────────────────────────
    if (batch && batch.length > 0) {
      const enriched = await batchEnrich(batch);

      const results = await Promise.all(
        enriched.map(async (product, i) => {
          if (!product || product.ingredients.length === 0) {
            return {
              input: batch[i],
              found: false,
              product: null,
              analysis: null,
            };
          }

          let analysis = null;
          if (analyze && product.ingredients.length > 0) {
            try {
              analysis = await analyzeIngredients(
                product.ingredients,
                product.category
              );
            } catch {
              // Analysis failed — still return the product
            }
          }

          return {
            input: batch[i],
            found: true,
            product,
            analysis,
          };
        })
      );

      return NextResponse.json(
        {
          mode: "batch",
          total: batch.length,
          found: results.filter((r) => r.found).length,
          results,
        },
        { headers: corsHeaders() }
      );
    }

    // ── Single product mode ─────────────────────────────────────────────────
    if (!name && !barcode) {
      return errorResponse(
        "Provide 'name', 'barcode', or 'batch' array",
        400
      );
    }

    let product = null;
    let debugInfo: Record<string, unknown> = {};

    try {
      if (barcode) {
        product = await enrichByBarcode(barcode);
      } else if (name) {
        product = await enrichByName(name, brand);
      }
    } catch (enrichError) {
      debugInfo.enrichError = enrichError instanceof Error ? enrichError.message : String(enrichError);
    }

    debugInfo.braveKeySet = !!process.env.BRAVE_SEARCH_API_KEY;
    debugInfo.geminiKeySet = !!process.env.GOOGLE_AI_API_KEY;

    if (!product || product.ingredients.length === 0) {
      return NextResponse.json(
        {
          found: false,
          message: `Could not find product details for: ${name || barcode}`,
          product: product || null,
          debug: debugInfo,
        },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Run AI analysis if requested and we have ingredients
    let analysis = null;
    if (analyze && product.ingredients.length > 0) {
      try {
        analysis = await analyzeIngredients(
          product.ingredients,
          product.category
        );
      } catch (err) {
        console.error("Analysis failed during enrichment:", err);
      }
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
        analysis: analysis
          ? {
              score: analysis.score,
              grade: analysis.grade,
              summary: analysis.summary,
              ingredients: analysis.ingredients,
              warnings: analysis.warnings,
              healthier_tip: analysis.healthier_tip,
            }
          : null,
      },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error("Enrich error:", error);
    const message =
      error instanceof Error ? error.message : "Enrichment failed";
    return errorResponse(message, 500);
  }
}
