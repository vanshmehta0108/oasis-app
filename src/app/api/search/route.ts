import { NextRequest, NextResponse } from "next/server";
import { masterSearch } from "@/lib/master";
import { supabase } from "@/lib/supabase";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "99",
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const category = searchParams.get("category");
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(Math.max(1, rawLimit), 100);

    if (!q || q.length < 2) {
      return errorResponse(
        "Search query must be at least 2 characters",
        400
      );
    }

    let query = supabase
      .from("products")
      .select("id, barcode, name, brand, category, safety_score, score_grade, image_url, scan_count")
      .or(`name.ilike.%${q}%,brand.ilike.%${q}%`)
      .order("scan_count", { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Search error:", error);
      return errorResponse("Search failed", 500, error.message);
    }

    const dbResults = data ?? [];

    // Merge with master sheet results (catches products not yet in Supabase)
    const masterResults = masterSearch(q, limit);
    const seenBarcodes = new Set(dbResults.map((r: { barcode: string }) => r.barcode));

    const extraFromMaster = masterResults
      .filter((m) => !seenBarcodes.has(m.barcode))
      .map((m) => ({
        barcode: m.barcode,
        name: m.name,
        brand: m.brand,
        safety_score: m.score,
        score_grade: m.grade,
        scan_count: 0,
      }));

    const results = [...dbResults, ...extraFromMaster].slice(0, limit);

    return NextResponse.json(
      { results, count: results.length, query: q },
      {
        headers: {
          ...corsHeaders(),
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Search error:", error);
    const message = error instanceof Error ? error.message : "Search failed";
    return errorResponse(message, 500);
  }
}
