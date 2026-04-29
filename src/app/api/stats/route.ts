export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
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

export async function GET() {
  if (Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({
      productCount: cache.productCount,
      flaggedCount: cache.flaggedCount,
      categoryCounts: cache.categoryCounts,
    });
  }

  const supabase = adminClient();

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
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
