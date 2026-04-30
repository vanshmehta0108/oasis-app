import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function isAuthorized(req: NextRequest): boolean {
  // Header-only — querystring keys leak via proxy logs, browser history, referrers.
  const key = req.headers.get("x-admin-key");
  // Trim defensively — see admin/import/route.ts for context.
  const secret = process.env.ADMIN_SECRET?.trim();
  return !!secret && key?.trim() === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;
  const search = req.nextUrl.searchParams.get("q") || "";

  let query = supabase.from("products").select("id, barcode, name, brand, category, safety_score, score_grade, source, created_at", { count: "exact" });

  if (search) {
    query = query.or(`name.ilike.%${search}%,brand.ilike.%${search}%,barcode.eq.${search}`);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ products: data, total: count, page, pages: Math.ceil((count || 0) / limit) });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
