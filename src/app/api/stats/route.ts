export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";

// Use the anon key, not the service-role key. This endpoint exposes only
// public counts (rows the app already lets users see); RLS enforces what
// anon can read. Defence-in-depth: even if someone smuggles a SQL trick
// past Postgres parameterization, they can only do what RLS permits.
function publicClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  return createClient(url, key, { auth: { persistSession: false } });
}

const CATEGORIES = ["food", "beverage", "snack", "dairy", "baby_food", "skincare", "haircare", "cosmetic", "household"] as const;

type Cache = {
  productCount: number;
  flaggedCount: number;
  categoryCounts: Record<string, number>;
  ts: number;
};

const cache: Cache = {
  productCount: 0,
  flaggedCount: 0,
  categoryCounts: {},
  ts: 0,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const corsOpts = { methods: ["GET", "OPTIONS"] as const };

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return corsPreflight(req, corsOpts);
}

export async function GET(req: NextRequest) {
  const cors = corsHeadersFor(req, corsOpts);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`stats:${ip}`, { capacity: 30, refillPerMin: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limit", retryAfter: rl.retryAfter },
      { status: 429, headers: { ...cors, "Retry-After": String(rl.retryAfter) } },
    );
  }

  if (Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(
      {
        productCount: cache.productCount,
        flaggedCount: cache.flaggedCount,
        categoryCounts: cache.categoryCounts,
      },
      { headers: cors },
    );
  }

  const supabase = publicClient();

  const [productCountRes, flaggedCountRes, ...catResults] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }).gt("safety_score", 0),
    supabase.from("products").select("*", { count: "exact", head: true }).gt("safety_score", 0).lt("safety_score", 50),
    ...CATEGORIES.map((cat) =>
      supabase.from("products").select("*", { count: "exact", head: true }).eq("category", cat)
    ),
  ]);

  if (!productCountRes.error) cache.productCount = productCountRes.count ?? cache.productCount;
  if (!flaggedCountRes.error) cache.flaggedCount = flaggedCountRes.count ?? cache.flaggedCount;

  const newCats: Record<string, number> = { ...cache.categoryCounts };
  CATEGORIES.forEach((cat, i) => {
    const res = catResults[i];
    if (res && !res.error && res.count !== null) {
      newCats[cat] = res.count;
    }
  });
  cache.categoryCounts = newCats;
  cache.ts = Date.now();

  return NextResponse.json(
    {
      productCount: cache.productCount,
      flaggedCount: cache.flaggedCount,
      categoryCounts: cache.categoryCounts,
    },
    { headers: { ...cors, "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
