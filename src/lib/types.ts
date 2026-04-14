// ── Shared types for the Oasis app ──────────────────────────────────────────

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

export const categories = [
  { name: "Food", icon: "🍚", count: 0 },
  { name: "Beverages", icon: "🥤", count: 0 },
  { name: "Snacks", icon: "🍿", count: 0 },
  { name: "Skincare", icon: "✨", count: 0 },
  { name: "Baby", icon: "👶", count: 0 },
  { name: "Household", icon: "🏠", count: 0 },
];
