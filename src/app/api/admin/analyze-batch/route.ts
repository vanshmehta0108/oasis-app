// @ts-nocheck — Supabase typed client has generic inference issues
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { analyzeIngredients } from "@/lib/scoring";
import type { Product } from "@/lib/database.types";

function isAuthorized(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key") || req.nextUrl.searchParams.get("key");
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return key === secret;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const batchSize: number = Math.min(body.batch_size || 5, 20);
  const category: string | undefined = body.category;

  // Get unanalyzed products that have ingredients
  let query = supabase
    .from("products")
    .select("*")
    .is("analysis", null)
    .not("ingredients", "eq", "{}");

  if (category) {
    query = query.eq("category", category);
  }

  // Prioritize products with higher scan_count (more popular = analyze first)
  const { data: products, error } = await query
    .order("scan_count", { ascending: false })
    .limit(batchSize);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!products || products.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No unanalyzed products with ingredients found",
      analyzed: 0,
    });
  }

  const results: { barcode: string; name: string; score: number; grade: string }[] = [];
  const errors: string[] = [];

  for (const raw of products) {
    const product = raw as Product;
    if (!product.ingredients || product.ingredients.length === 0) continue;

    try {
      const analysis = await analyzeIngredients(product.ingredients, product.category);

      const { error: updateErr } = await supabase
        .from("products")
        .update({
          safety_score: analysis.score,
          score_grade: analysis.grade,
          analysis: analysis as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("barcode", product.barcode);

      if (updateErr) {
        errors.push(`Update failed for ${product.barcode}: ${updateErr.message}`);
      } else {
        results.push({
          barcode: product.barcode,
          name: product.name,
          score: analysis.score,
          grade: analysis.grade,
        });
      }
    } catch (err) {
      errors.push(`Analysis failed for ${product.barcode} (${product.name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    success: true,
    analyzed: results.length,
    failed: errors.length,
    results,
    errors: errors.slice(0, 10),
  });
}

// GET — show analysis stats
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { count: total } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  const { count: analyzed } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .not("analysis", "is", null);

  const { count: withIngredients } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .not("ingredients", "eq", "{}");

  const unanalyzed = (withIngredients || 0) - (analyzed || 0);

  return NextResponse.json({
    total: total || 0,
    analyzed: analyzed || 0,
    with_ingredients: withIngredients || 0,
    unanalyzed_with_ingredients: unanalyzed,
    no_ingredients: (total || 0) - (withIngredients || 0),
  });
}
