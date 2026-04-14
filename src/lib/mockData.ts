// ── Types (kept for backward compatibility — all data now comes from Supabase) ──

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

export interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  safety_score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  image_url: string;
  analysis: ProductAnalysis;
}

// ── Static data ─────────────────────────────────────────────────────────────

export const categories = [
  { name: "Food", icon: "🍚", count: 0 },
  { name: "Beverages", icon: "🥤", count: 0 },
  { name: "Snacks", icon: "🍿", count: 0 },
  { name: "Skincare", icon: "✨", count: 0 },
  { name: "Baby", icon: "👶", count: 0 },
  { name: "Household", icon: "🏠", count: 0 },
];

// ── Deprecated stubs (all data now fetched from Supabase via db.ts) ─────────
// These exist only to prevent import errors during migration.

export const products: Product[] = [];

export function getProductById(_id: string): Product | undefined {
  return undefined;
}

export function getProductByBarcode(_barcode: string): Product | undefined {
  return undefined;
}

export function searchProducts(_query: string, _category?: string): Product[] {
  return [];
}

export function getTrendingProducts(): Product[] {
  return [];
}

export function getWorstRated(): Product[] {
  return [];
}
