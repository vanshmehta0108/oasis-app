// @ts-nocheck — Supabase typed client has generic inference issues with partial inserts/updates
import { supabase } from "./supabase";
import type {
  Product,
  ProductInsert,
  CommunitySubmissionInsert,
  ProductCategory,
  ScanSource,
} from "./database.types";

// Filter that excludes unreviewed user submissions from public aggregates.
// Anything with a `manual-*` barcode was added via /api/add-product without
// any moderation — it stays accessible via direct URL and scan history, but
// we don't surface it in Trending/Worst/Recent/counts/search until approved.
const PUBLIC_ONLY = "barcode.not.like.manual-%";

// ── Single product lookups ──────────────────────────────────────────────────

export async function getProductByBarcode(
  barcode: string
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("barcode", barcode)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Failed to fetch product:", error.message);
  }
  return data as Product | null;
}

export async function getProductById(
  id: string
): Promise<Product | null> {
  // Try barcode first (our route IDs are barcodes)
  const byBarcode = await getProductByBarcode(id);
  if (byBarcode) return byBarcode;

  // Try UUID
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  return (data as Product) || null;
}

// ── Search ──────────────────────────────────────────────────────────────────

// Highest-scoring products in the same category, excluding the current
// product. Used in the "Top rated in category" strip on product pages.
export async function getTopRatedInCategory(
  category: string,
  excludeBarcode: string,
  limit = 8,
): Promise<Product[]> {
  if (!category) return [];
  const dbCat = category.toLowerCase();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("category", dbCat as ProductCategory)
    .or(PUBLIC_ONLY)
    .not("safety_score", "is", null)
    .neq("barcode", excludeBarcode)
    .order("safety_score", { ascending: false })
    .limit(limit);
  return (data as Product[]) ?? [];
}

export async function getProductsByCategory(
  category: string,
  limit = 40
): Promise<Product[]> {
  const categoryMap: Record<string, string> = {
    Food: "food", Beverages: "beverage", Snacks: "snack",
    Skincare: "skincare", Baby: "baby_food", Household: "household",
  };
  const dbCat = categoryMap[category] || category.toLowerCase();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("category", dbCat as ProductCategory)
    .or(PUBLIC_ONLY)
    .order("scan_count", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Category browse failed:", error.message);
    return [];
  }
  return (data as Product[]) ?? [];
}

export async function searchProducts(
  query: string,
  category?: string,
  limit = 20
): Promise<Product[]> {
  // Escape PostgREST .or() filter metacharacters. Commas split clauses,
  // parentheses group them, and backslashes escape — all must be sanitized
  // so special characters in product names don't break the query.
  const safe = query.replace(/[,()\\]/g, " ").replace(/\s+/g, " ").trim();
  let q = supabase
    .from("products")
    .select("*")
    .or(`name.ilike.%${safe}%,brand.ilike.%${safe}%,barcode.eq.${safe}`)
    .or(PUBLIC_ONLY)
    .limit(limit);

  if (category && category !== "All") {
    const categoryMap: Record<string, string> = {
      Food: "food",
      Beverages: "beverage",
      Snacks: "snack",
      Skincare: "skincare",
      Baby: "baby_food",
      Household: "household",
    };
    const dbCat = categoryMap[category] || category.toLowerCase();
    q = q.eq("category", dbCat as ProductCategory);
  }

  const { data, error } = await q.order("scan_count", { ascending: false });

  if (error) {
    console.error("Search failed:", error.message);
    return [];
  }
  return (data as Product[]) ?? [];
}

// ── Aggregation queries (homepage) ──────────────────────────────────────────

export async function getTrendingProducts(limit = 6): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("*")
    .or(PUBLIC_ONLY)
    .order("scan_count", { ascending: false })
    .limit(limit);
  return (data as Product[]) ?? [];
}

export async function getWorstRated(limit = 4): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("*")
    .or(PUBLIC_ONLY)
    .not("safety_score", "is", null)
    .order("safety_score", { ascending: true })
    .limit(limit);
  return (data as Product[]) ?? [];
}

export async function getRecentProducts(limit = 4): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("*")
    .or(PUBLIC_ONLY)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as Product[]) ?? [];
}

export async function getProductCount(): Promise<number> {
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .or(PUBLIC_ONLY);
  return count || 0;
}

export async function getFlaggedCount(): Promise<number> {
  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .or(PUBLIC_ONLY)
    .lt("safety_score", 50);
  return count || 0;
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  const cats = ["food","beverage","snack","dairy","baby_food","skincare","haircare","cosmetic","household","water"];
  const results = await Promise.all(
    cats.map(async (cat) => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("category", cat);
      return [cat, count ?? 0] as const;
    })
  );
  return Object.fromEntries(results);
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function upsertProduct(
  product: Partial<ProductInsert> & { barcode: string }
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .upsert(product as ProductInsert, { onConflict: "barcode" })
    .select()
    .single();

  if (error) {
    throw new Error(`Upsert failed: ${error.message}`);
  }
  return data as Product;
}

export async function recordScan(
  productId: string,
  userId?: string,
  source: ScanSource = "barcode"
): Promise<void> {
  const { error: scanError } = await supabase.from("scans").insert({
    product_id: productId,
    user_id: userId ?? null,
    source,
  });

  if (scanError) {
    console.error("Failed to record scan:", scanError.message);
  }

  // Increment scan_count via RPC
  const { error: rpcError } = await supabase.rpc(
    "increment_scan_count" as string,
    { product_barcode: productId } as Record<string, unknown>
  );

  if (rpcError) {
    // Fallback: manual increment (productId is a barcode, not UUID)
    const { data: product } = await supabase
      .from("products")
      .select("scan_count")
      .eq("barcode", productId)
      .single();

    if (product) {
      const currentCount = (product as { scan_count: number }).scan_count;
      await supabase
        .from("products")
        .update({ scan_count: currentCount + 1 })
        .eq("barcode", productId);
    }
  }
}

export async function submitCommunityProduct(
  submission: Omit<CommunitySubmissionInsert, "id" | "status" | "reviewed_at" | "created_at">
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("community_submissions")
    .insert(submission as CommunitySubmissionInsert)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Submission failed: ${error.message}`);
  }
  return data as { id: string };
}

// ── Get all product barcodes (for sitemap) ──────────────────────────────────

export async function getAllProductBarcodes(): Promise<string[]> {
  // Sitemap — only public, non-manual submissions.
  const { data } = await supabase
    .from("products")
    .select("barcode")
    .or(PUBLIC_ONLY);
  return ((data as { barcode: string }[]) || []).map((r) => r.barcode);
}
