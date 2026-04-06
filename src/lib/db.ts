// @ts-nocheck — Supabase typed client has generic inference issues with partial inserts/updates
import { supabase } from "./supabase";
import type {
  Product,
  ProductInsert,
  CommunitySubmissionInsert,
  WaterQuality,
  ProductCategory,
  ScanSource,
} from "./database.types";

export async function getProductByBarcode(
  barcode: string
): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("barcode", barcode)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to fetch product: ${error.message}`);
  }
  return data as Product | null;
}

export async function searchProducts(
  query: string,
  category?: string,
  limit = 20
): Promise<Product[]> {
  let q = supabase
    .from("products")
    .select("*")
    .or(`name.ilike.%${query}%,brand.ilike.%${query}%,barcode.eq.${query}`)
    .limit(limit);

  if (category) {
    q = q.eq("category", category as ProductCategory);
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
  return (data as Product[]) ?? [];
}

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
    throw new Error(`Failed to record scan: ${scanError.message}`);
  }

  // Increment scan_count — try RPC first, fall back to manual update
  const { error: rpcError } = await supabase.rpc(
    "increment_scan_count" as string,
    { product_id: productId } as Record<string, unknown>
  );

  if (rpcError) {
    const { data: product } = await supabase
      .from("products")
      .select("scan_count")
      .eq("id", productId)
      .single();

    if (product) {
      const currentCount = (product as { scan_count: number }).scan_count;
      await supabase
        .from("products")
        .update({ scan_count: currentCount + 1 })
        .eq("id", productId);
    }
  }
}

export async function getTopProducts(
  category?: string,
  limit = 20
): Promise<Product[]> {
  let q = supabase
    .from("products")
    .select("*")
    .order("scan_count", { ascending: false })
    .limit(limit);

  if (category) {
    q = q.eq("category", category as ProductCategory);
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(`Failed to fetch top products: ${error.message}`);
  }
  return (data as Product[]) ?? [];
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

export async function getWaterQuality(
  state: string,
  district?: string
): Promise<WaterQuality[]> {
  let q = supabase
    .from("water_quality")
    .select("*")
    .eq("state", state)
    .order("tested_at", { ascending: false });

  if (district) {
    q = q.eq("district", district);
  }

  const { data, error } = await q;

  if (error) {
    throw new Error(`Failed to fetch water quality: ${error.message}`);
  }
  return (data as WaterQuality[]) ?? [];
}
