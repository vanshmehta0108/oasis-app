/**
 * Master product data — static JSON bundled at build time.
 * This is the FIRST lookup tier. Zero API calls, zero DB calls.
 *
 * Flow: Master (free) → Supabase (free) → Gemini (paid, one-time)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import masterData from "@/data/master-products.json" with { type: "json" };

interface MasterProduct {
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  image_url: string | null;
  safety_score: number | null;
  score_grade: string | null;
  analysis: Record<string, unknown> | null;
  nutritional_info: Record<string, unknown> | null;
  fssai_license: string | null;
}

interface SearchEntry {
  b: string;  // barcode
  n: string;  // name (lowercase)
  br: string; // brand (lowercase)
  s: number | null;  // score
  g: string | null;  // grade
}

interface MasterData {
  generated_at: string;
  total: number;
  scored: number;
  products: Record<string, MasterProduct>;
  search_index: SearchEntry[];
}

const master = masterData as unknown as MasterData;

/**
 * Look up a product by barcode from the static master sheet.
 * Returns null if not found — caller should fall through to Supabase.
 */
export function masterLookup(barcode: string): MasterProduct | null {
  return master.products[barcode] || null;
}

/**
 * Check if a barcode exists in the master sheet AND has a score.
 */
export function masterHasScore(barcode: string): boolean {
  const product = masterLookup(barcode);
  return product !== null && product.safety_score !== null;
}

/**
 * Search the master sheet by name or brand.
 * Returns top matches sorted by relevance.
 */
export function masterSearch(query: string, limit = 20): {
  barcode: string;
  name: string;
  brand: string;
  score: number | null;
  grade: string | null;
}[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const terms = q.split(/\s+/);

  const results = master.search_index
    .map((entry) => {
      const text = `${entry.n} ${entry.br}`;
      let relevance = 0;

      // Exact barcode match
      if (entry.b === q) return { entry, relevance: 1000 };

      // All terms must appear
      const allMatch = terms.every((t) => text.includes(t));
      if (!allMatch) return { entry, relevance: 0 };

      // Score by match quality
      for (const t of terms) {
        if (entry.n.startsWith(t)) relevance += 10;
        else if (entry.n.includes(t)) relevance += 5;
        if (entry.br.startsWith(t)) relevance += 8;
        else if (entry.br.includes(t)) relevance += 3;
      }

      // Boost scored products
      if (entry.s !== null) relevance += 2;

      return { entry, relevance };
    })
    .filter((r) => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);

  return results.map((r) => {
    const full = master.products[r.entry.b];
    return {
      barcode: r.entry.b,
      name: full?.name || "",
      brand: full?.brand || "",
      score: r.entry.s,
      grade: r.entry.g,
    };
  });
}

/**
 * Get master sheet stats.
 */
export function masterStats(): { total: number; scored: number; generated_at: string } {
  return {
    total: master.total,
    scored: master.scored,
    generated_at: master.generated_at,
  };
}
