import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyzeIngredients } from "@/lib/scoring";
import { log } from "@/lib/log";
import type { ProductInsert, ProductCategory, ScoreGrade } from "@/lib/database.types";

function isAuthorized(req: NextRequest): boolean {
  // Header-only — querystring keys leak via proxy logs, browser history, referrers.
  const key = req.headers.get("x-admin-key");
  const secret = process.env.ADMIN_SECRET;
  return !!secret && key === secret;
}

// List pending submissions, newest first. Cheap — bounded by default limit.
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = (req.nextUrl.searchParams.get("status") as "pending" | "approved" | "rejected") || "pending";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 100);

  const { data, error } = await supabase
    .from("community_submissions")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

const ActionRequest = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  // Optional moderator overrides applied on approval — lets the admin
  // clean up the ingredient list or pick a different category before
  // the product becomes public.
  overrides: z
    .object({
      name: z.string().optional(),
      brand: z.string().optional(),
      category: z.string().optional(),
      ingredients: z.array(z.string()).optional(),
    })
    .optional(),
});

// Approve → create a real products row (AI-scored) + mark submission approved.
// Reject → mark submission rejected; row stays as an audit trail.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = ActionRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { id, action, overrides } = parsed.data;

  // Load the submission
  const { data: submission, error: loadErr } = await supabase
    .from("community_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const row = submission as Record<string, unknown>;

  if (action === "reject") {
    const { error } = await supabase
      .from("community_submissions")
      // @ts-expect-error Supabase generated types mismatch
      .update({ status: "rejected" as const, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    log.info("moderation.reject", { id, barcode: row.barcode });
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  // approve
  const name = overrides?.name || (row.product_name as string);
  const brand = overrides?.brand || ((row as Record<string, unknown>).brand as string) || "Unknown";
  const category = (overrides?.category || (row as Record<string, unknown>).category || "food") as string;
  const ingredients = overrides?.ingredients || (row.extracted_ingredients as string[]) || [];
  const barcode = (row.barcode as string) || `manual-${Date.now()}`;

  // Score it if we have ingredients to score.
  let analysis: Awaited<ReturnType<typeof analyzeIngredients>> | null = null;
  if (ingredients.length > 0) {
    try {
      analysis = await analyzeIngredients(ingredients, category);
    } catch (err) {
      log.warn("moderation.score_fail", { id, err: err instanceof Error ? err.message : String(err) });
      // Proceed without analysis — admin can re-trigger from the products tab.
    }
  }

  const productData: ProductInsert = {
    barcode,
    name,
    brand,
    category: category as ProductCategory,
    ingredients,
    ...(analysis
      ? {
          safety_score: analysis.score,
          score_grade: analysis.grade as ScoreGrade,
          analysis: {
            ...analysis,
            healthier_alternative: (analysis as unknown as { healthier_tip?: string }).healthier_tip,
          } as unknown as Record<string, unknown>,
        }
      : {}),
  };

  const { error: upsertErr } = await supabase
    .from("products")
    // @ts-expect-error Supabase generated types mismatch
    .upsert(productData, { onConflict: "barcode" });

  if (upsertErr) {
    log.error("moderation.approve_fail", { id, err: upsertErr.message });
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  const { error: statusErr } = await supabase
    .from("community_submissions")
    // @ts-expect-error Supabase generated types mismatch
    .update({ status: "approved" as const, reviewed_at: new Date().toISOString() })
    .eq("id", id);

  if (statusErr) {
    log.warn("moderation.status_update_fail", { id, err: statusErr.message });
  }

  log.info("moderation.approve", { id, barcode, category, scored: !!analysis });
  return NextResponse.json({ ok: true, status: "approved", scored: !!analysis });
}
