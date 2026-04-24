import { supabase } from "./supabase";
import type { Product, ProductCategory } from "./database.types";

export type { Product };

// Re-export the types that components need
export interface IngredientAnalysis {
  name: string;
  risk: "safe" | "caution" | "warning" | "danger";
  explanation: string;
}

export interface ProductAnalysis {
  summary: string;
  ingredients: IngredientAnalysis[];
  warnings: string[];
  healthier_alternative: string;
}

/** Unified product shape for UI components */
export interface UIProduct {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  safety_score: number | null;
  grade: string | null;
  image_url: string | null;
  analysis: ProductAnalysis | null;
}

function dbToUI(p: Product): UIProduct {
  return {
    id: p.id,
    barcode: p.barcode,
    name: p.name,
    brand: p.brand,
    category: p.category,
    ingredients: p.ingredients,
    safety_score: p.safety_score,
    grade: p.score_grade,
    image_url: p.image_url,
    analysis: p.analysis as ProductAnalysis | null,
  };
}

const categoryMap: Record<string, ProductCategory> = {
  All: "food", // unused but keeps TS happy
  Food: "food",
  Snacks: "snack",
  Beverages: "beverage",
  Dairy: "dairy",
  Skincare: "skincare",
  Baby: "baby_food",
  Household: "household",
};

/** Search products in Supabase */
export async function searchProducts(
  query: string,
  category?: string,
  limit = 30
): Promise<UIProduct[]> {
  let q = supabase.from("products").select("*").limit(limit);

  if (category && category !== "All") {
    const mapped = categoryMap[category];
    if (mapped) q = q.eq("category", mapped);
  }

  if (query && query.length > 0) {
    q = q.or(
      `name.ilike.%${query}%,brand.ilike.%${query}%,barcode.eq.${query}`
    );
  }

  const { data, error } = await q;
  if (error) {
    console.error("Search error:", error.message);
    return [];
  }
  return (data ?? []).map(dbToUI);
}

/** Get product by its UUID */
export async function getProductById(
  id: string
): Promise<UIProduct | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data ? dbToUI(data as Product) : null;
}

/** Get product by barcode */
export async function getProductByBarcode(
  barcode: string
): Promise<UIProduct | null> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("barcode", barcode)
    .single();

  if (error) return null;
  return data ? dbToUI(data as Product) : null;
}

/** Recently added products */
export async function getRecentProducts(limit = 6): Promise<UIProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []).map(dbToUI);
}

/** Products with highest scan counts (trending) */
export async function getTrendingProducts(limit = 8): Promise<UIProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("scan_count", { ascending: false })
    .not("name", "eq", "")
    .limit(limit);

  if (error) return [];
  return (data ?? []).map(dbToUI);
}

/** Featured products — products that have been analyzed (have safety_score) */
export async function getFeaturedProducts(limit = 8): Promise<UIProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .not("safety_score", "is", null)
    .order("safety_score", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []).map(dbToUI);
}

/** Get real category counts */
export async function getCategoryCounts(): Promise<
  { name: string; icon: string; count: number; key: ProductCategory }[]
> {
  const cats: { name: string; icon: string; key: ProductCategory }[] = [
    { name: "Food", icon: "🍚", key: "food" },
    { name: "Beverages", icon: "🥤", key: "beverage" },
    { name: "Snacks", icon: "🍿", key: "snack" },
    { name: "Dairy", icon: "🥛", key: "dairy" },
    { name: "Skincare", icon: "✨", key: "skincare" },
    { name: "Baby", icon: "👶", key: "baby_food" },
    { name: "Household", icon: "🏠", key: "household" },
  ];

  const results = await Promise.all(
    cats.map(async (cat) => {
      const { count, error } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("category", cat.key);

      return {
        name: cat.name,
        icon: cat.icon,
        key: cat.key,
        count: error ? 0 : (count ?? 0),
      };
    })
  );

  return results.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
}

/** Get total product count */
export async function getTotalProductCount(): Promise<number> {
  const { count, error } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  if (error) return 0;
  return count ?? 0;
}

/** Get total scans count */
export async function getTotalScanCount(): Promise<number> {
  const { count, error } = await supabase
    .from("scans")
    .select("*", { count: "exact", head: true });

  if (error) return 0;
  return count ?? 0;
}
