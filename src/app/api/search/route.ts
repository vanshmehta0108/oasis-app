import { NextRequest, NextResponse } from "next/server";
import { masterSearch } from "@/lib/master";
import { supabase } from "@/lib/supabase";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";
import { checkRateLimit } from "@/lib/rateLimit";

// ── Helpers ─────────────────────────────────────────────────────────────────────

const corsOpts = { methods: ["GET", "OPTIONS"] as const };

function errorResponse(req: NextRequest, message: string, status: number, details?: string): NextResponse {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status, headers: corsHeadersFor(req, corsOpts) }
  );
}

// Strip control chars + Postgres ilike wildcards from user search input. Even
// though Supabase parameterizes, escaping the % and _ wildcards prevents users
// from converting a 2-char search into a slow full-table scan.
function escapeIlike(s: string): string {
  return s.replace(/[%_\\]/g, (m) => `\\${m}`);
}

// ── Handler ─────────────────────────────────────────────────────────────────────

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return corsPreflight(req, corsOpts);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cors = corsHeadersFor(req, corsOpts);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`search:${ip}`, { capacity: 60, refillPerMin: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limit", retryAfter: rl.retryAfter },
      { status: 429, headers: { ...cors, "Retry-After": String(rl.retryAfter) } },
    );
  }
  try {
    const { searchParams } = new URL(req.url);
    const rawQ = searchParams.get("q")?.trim();
    const category = searchParams.get("category")?.slice(0, 30);
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(Math.max(1, rawLimit), 50);

    if (!rawQ || rawQ.length < 2) {
      return errorResponse(req,
        "Search query must be at least 2 characters",
        400
      );
    }
    if (rawQ.length > 100) {
      return errorResponse(req, "Search query too long", 400);
    }
    const q = escapeIlike(rawQ);

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
      console.error("Search error:", error.message);
      return errorResponse(req, "Search failed", 500);
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
      { results, count: results.length, query: rawQ },
      {
        headers: {
          ...cors,
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Search error:", error instanceof Error ? error.message : String(error));
    return errorResponse(req, "Search failed", 500);
  }
}
