export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return createClient(url, key, { auth: { persistSession: false } });
}

// Module-level in-memory cache — survives across requests in the same Node.js process.
const cache: { productCount: number; flaggedCount: number; ts: number } = {
  productCount: 0,
  flaggedCount: 0,
  ts: 0,
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  // Serve cached if still fresh.
  if (Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ productCount: cache.productCount, flaggedCount: cache.flaggedCount });
  }

  const supabase = adminClient();

  // Simplified queries without the barcode LIKE filter — index-friendly.
  // Manual-* products are a tiny fraction; including them in the display count
  // is acceptable and avoids the slow NOT LIKE scan.
  const [productCountRes, flaggedCountRes] = await Promise.all([
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .gt("safety_score", 0),

    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .gt("safety_score", 0)
      .lt("safety_score", 50),
  ]);

  // Only update cache if queries succeeded; keep stale values on failure.
  if (!productCountRes.error) cache.productCount = productCountRes.count ?? cache.productCount;
  if (!flaggedCountRes.error) cache.flaggedCount = flaggedCountRes.count ?? cache.flaggedCount;
  cache.ts = Date.now();

  return NextResponse.json(
    { productCount: cache.productCount, flaggedCount: cache.flaggedCount },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
