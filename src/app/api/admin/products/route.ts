import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { isAdminAuthorized } from "@/lib/adminAuth";

const DeleteBody = z.object({ id: z.string().uuid() });

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;
  const rawSearch = req.nextUrl.searchParams.get("q") || "";
  // Strip PostgREST `or()` operator separators to prevent injection of extra
  // filter clauses through the search box.
  const search = rawSearch.slice(0, 100).replace(/[,()*]/g, "");

  let query = supabase
    .from("products")
    .select("id, barcode, name, brand, category, safety_score, score_grade, source, created_at", { count: "exact" });

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
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = DeleteBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid id (UUID required)" }, { status: 400 });
  }

  const { error } = await supabase.from("products").delete().eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
