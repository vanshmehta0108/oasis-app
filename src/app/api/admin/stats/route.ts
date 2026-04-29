// Admin stats — Node runtime for reliable Supabase queries

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function isAuthorized(req: NextRequest): boolean {
  // Header-only — querystring keys leak via proxy logs, browser history, referrers.
  const key = req.headers.get("x-admin-key");
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return key === secret;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    { count: total },
    { count: analyzed },
    { count: withIngredients },
    { data: categories },
    { data: sources },
    { data: gradeData },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).not("analysis", "is", null),
    supabase.from("products").select("*", { count: "exact", head: true }).not("ingredients", "eq", "{}"),
    supabase.from("products").select("category"),
    supabase.from("products").select("source"),
    supabase.from("products").select("score_grade").not("score_grade", "is", null),
  ]);

  const catCounts: Record<string, number> = {};
  ((categories as { category: string }[]) || []).forEach((r) => {
    catCounts[r.category] = (catCounts[r.category] || 0) + 1;
  });

  const srcCounts: Record<string, number> = {};
  ((sources as { source: string }[]) || []).forEach((r) => {
    srcCounts[r.source] = (srcCounts[r.source] || 0) + 1;
  });

  const gradeCounts: Record<string, number> = {};
  ((gradeData as { score_grade: string }[]) || []).forEach((r) => {
    gradeCounts[r.score_grade] = (gradeCounts[r.score_grade] || 0) + 1;
  });

  return NextResponse.json({
    total: total || 0,
    analyzed: analyzed || 0,
    with_ingredients: withIngredients || 0,
    unanalyzed: (withIngredients || 0) - (analyzed || 0),
    by_category: catCounts,
    by_source: srcCounts,
    by_grade: gradeCounts,
  });
}
