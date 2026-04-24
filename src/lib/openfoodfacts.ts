// ── Open Food Facts API client ─────────────────────────────────────────────────

export interface OFFProduct {
  code: string;
  product_name: string;
  brands: string;
  categories: string;
  ingredients_text: string;
  image_url: string;
}

export interface MappedOFFProduct {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  image_url: string;
}

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";

// Map Open Food Facts category slugs to the app's 6 display categories.
// OFF returns strings like "en:breakfast-cereals,en:snacks,en:sweet-snacks".
function mapOFFCategory(raw: string | undefined): string {
  if (!raw) return "Food";
  const lowered = raw.toLowerCase();
  if (/beverag|drink|juice|water|soda|tea|coffee|milk/.test(lowered)) return "Beverages";
  if (/snack|cereal|chocolate|confectioner|biscuit|crisps|chips|namkeen|mithai/.test(lowered)) return "Snacks";
  if (/baby|infant|toddler/.test(lowered)) return "Baby";
  if (/cosmetic|skincare|skin-care|beauty|lotion|cream|soap|shampoo/.test(lowered)) return "Skincare";
  if (/household|cleaning|detergent/.test(lowered)) return "Household";
  return "Food";
}

export async function fetchProductByBarcode(
  barcode: string
): Promise<MappedOFFProduct | null> {
  try {
    const res = await fetch(
      `${OFF_BASE}/${barcode}.json?fields=code,product_name,brands,categories,ingredients_text,image_url`,
      {
        headers: { "User-Agent": "Oasis-HealthApp/1.0 (contact@oasis.health)" },
        next: { revalidate: 86400 },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product as OFFProduct;
    if (!p.product_name) return null;

    const ingredients = p.ingredients_text
      ? p.ingredients_text
          .split(/,\s*/)
          .map((i: string) => i.trim())
          .filter(Boolean)
      : [];

    return {
      id: `off-${barcode}`,
      barcode: p.code || barcode,
      name: p.product_name,
      brand: p.brands || "Unknown",
      category: mapOFFCategory(p.categories),
      ingredients,
      image_url: p.image_url || "",
    };
  } catch (error) {
    console.error("Open Food Facts fetch error:", error);
    return null;
  }
}

export async function searchOFFProducts(
  query: string,
  limit = 20
): Promise<MappedOFFProduct[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&countries_tags=en:india&json=1&page_size=${limit}&fields=code,product_name,brands,categories,ingredients_text,image_url`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Oasis-HealthApp/1.0 (contact@oasis.health)" },
    });

    if (!res.ok) return [];

    const data = await res.json();
    if (!data.products || !Array.isArray(data.products)) return [];

    return data.products
      .filter((p: OFFProduct) => p.product_name)
      .map((p: OFFProduct): MappedOFFProduct => {
        const ingredients = p.ingredients_text
          ? p.ingredients_text.split(/,\s*/).map((i: string) => i.trim()).filter(Boolean)
          : [];
        return {
          id: `off-${p.code}`,
          barcode: p.code || "",
          name: p.product_name,
          brand: p.brands || "Unknown",
          category: mapOFFCategory(p.categories),
          ingredients,
          image_url: p.image_url || "",
        };
      });
  } catch (error) {
    console.error("Open Food Facts search error:", error);
    return [];
  }
}
