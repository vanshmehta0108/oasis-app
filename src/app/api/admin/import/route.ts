// @ts-nocheck — Supabase typed client has generic inference issues
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ProductCategory } from "@/lib/database.types";
import { isAdminAuthorized } from "@/lib/adminAuth";

// ── OFF category → DB category mapping ─────────────────────────────────────────

function mapCategory(offCategories: string): ProductCategory {
  const lower = offCategories.toLowerCase();
  if (/beverage|drink|juice|soda|water|tea|coffee|lassi|buttermilk|sharbat/.test(lower)) return "beverage";
  if (/snack|chip|crisp|namkeen|bhujia|mixture|papad|kurkure|fryum/.test(lower)) return "snack";
  if (/dairy|milk|curd|yogurt|paneer|cheese|ghee|butter|cream|dahi/.test(lower)) return "dairy";
  if (/baby|infant|cerelac/.test(lower)) return "baby_food";
  if (/skincare|cream|lotion|face|sunscreen|moistur/.test(lower)) return "skincare";
  if (/hair|shampoo|conditioner/.test(lower)) return "haircare";
  if (/cosmetic|makeup|lipstick|foundation/.test(lower)) return "cosmetic";
  if (/household|cleaner|detergent|soap|dishwash/.test(lower)) return "household";
  return "food";
}

// ── Indian product search queries ──────────────────────────────────────────────

const INDIAN_QUERIES = [
  // Packaged food staples
  "maggi", "yippee", "top ramen", "knorr soupy",
  "parle", "britannia", "sunfeast", "unibic", "hide and seek",
  "haldiram", "bikano", "balaji", "kurkure", "lays india",
  "bournvita", "horlicks", "complan", "boost health drink",
  "kissan", "maggi ketchup", "tops", "ching's",
  "aashirvaad", "fortune", "saffola", "sundrop",
  "amul", "mother dairy", "nandini", "verka",
  "tata salt", "catch spices", "mdh", "everest masala",
  "dabur", "patanjali", "real juice", "tropicana india",
  "paper boat", "frooti", "maaza", "slice mango",
  "thums up", "limca", "campa cola", "sosyo",
  "lijjat papad", "sakthi masala", "aachi masala",
  // Biscuits & Sweets
  "parle g", "good day", "marie gold", "bourbon biscuit",
  "oreo india", "dark fantasy", "milk bikis", "50-50 biscuit",
  "gulab jamun mix", "rasmalai", "rasgulla",
  // Instant & Ready to eat
  "mtr ready to eat", "gits", "haldiram ready to eat",
  "act ii popcorn", "too yumm", "bingo",
  // Dairy
  "amul butter", "amul cheese", "mother dairy dahi",
  "epigamia", "go cheese", "milky mist",
  // Health & Nutrition
  "protinex", "ensure india", "saffola oats",
  "yoga bar", "ritebite", "open secret",
  // Oils
  "fortune oil", "saffola oil", "dhara oil", "gemini oil",
  "nature fresh", "sundrop oil",
  // Beverages
  "bru coffee", "nescafe india", "tata tea", "red label",
  "brooke bond", "society tea", "wagh bakri",
  "rasna", "tang india", "glucon d", "electral",
  // Baby food
  "cerelac india", "nestum", "farex",
  // Personal care (commonly scanned)
  "himalaya", "biotique", "mamaearth", "wow skin",
  "dove india", "lux soap", "dettol", "lifebuoy",
  "colgate india", "closeup", "pepsodent",
  "clinic plus", "head shoulders india", "pantene india",
];

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const queries: string[] = body.queries || INDIAN_QUERIES;
  const pageSize: number = Math.min(body.page_size || 50, 100);
  const maxPages: number = Math.min(body.max_pages || 1, 5);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const query of queries) {
    for (let page = 1; page <= maxPages; page++) {
      try {
        const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
        url.searchParams.set("search_terms", query);
        url.searchParams.set("countries_tags", "en:india");
        url.searchParams.set("json", "1");
        url.searchParams.set("page", String(page));
        url.searchParams.set("page_size", String(pageSize));
        url.searchParams.set("fields", "code,product_name,brands,categories,ingredients_text,image_url,nutriments");

        // Hard 8s ceiling per request so a stalled OFF response can't pin the
        // serverless function for its full maxDuration.
        const res = await fetch(url.toString(), {
          headers: { "User-Agent": "Oasis-HealthApp/1.0 (admin-import)" },
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          errors.push(`OFF API error for "${query}" page ${page}: ${res.status}`);
          continue;
        }

        const data = await res.json();
        const products = data.products;
        if (!Array.isArray(products) || products.length === 0) break;

        // Batch upsert
        const rows = products
          .filter((p: Record<string, string>) => p.code && p.product_name)
          .map((p: Record<string, unknown>) => {
            const ingredientsText = (p.ingredients_text as string) || "";
            const ingredients = ingredientsText
              ? ingredientsText.split(/,\s*/).map((i: string) => i.trim()).filter(Boolean)
              : [];

            const nutriments = (p.nutriments || {}) as Record<string, unknown>;
            const nutritionalInfo: Record<string, unknown> = {};
            if (nutriments["energy-kcal_100g"]) nutritionalInfo.energy_kcal = nutriments["energy-kcal_100g"];
            if (nutriments.fat_100g) nutritionalInfo.fat = nutriments.fat_100g;
            if (nutriments.sugars_100g) nutritionalInfo.sugars = nutriments.sugars_100g;
            if (nutriments.salt_100g) nutritionalInfo.salt = nutriments.salt_100g;
            if (nutriments.proteins_100g) nutritionalInfo.proteins = nutriments.proteins_100g;
            if (nutriments.fiber_100g) nutritionalInfo.fiber = nutriments.fiber_100g;
            if (nutriments["saturated-fat_100g"]) nutritionalInfo.saturated_fat = nutriments["saturated-fat_100g"];
            if (nutriments.sodium_100g) nutritionalInfo.sodium = nutriments.sodium_100g;
            if (nutriments.carbohydrates_100g) nutritionalInfo.carbohydrates = nutriments.carbohydrates_100g;

            return {
              barcode: p.code as string,
              name: p.product_name as string,
              brand: (p.brands as string) || "Unknown",
              category: mapCategory((p.categories as string) || ""),
              ingredients,
              image_url: (p.image_url as string) || null,
              nutritional_info: nutritionalInfo,
              source: "openfoodfacts",
              verified: false,
            };
          });

        if (rows.length === 0) {
          skipped += products.length;
          break;
        }

        // Upsert in chunks of 50 to stay within Supabase limits
        const CHUNK = 50;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error: upsertErr, count } = await supabase
            .from("products")
            // @ts-expect-error Supabase generic typing
            .upsert(chunk, { onConflict: "barcode", ignoreDuplicates: true })
            .select("barcode", { count: "exact", head: true });

          if (upsertErr) {
            failed += chunk.length;
            errors.push(`Upsert error: ${upsertErr.message}`);
          } else {
            imported += count || chunk.length;
          }
        }

        // If fewer products than page_size, no more pages
        if (products.length < pageSize) break;
      } catch (err) {
        errors.push(`Fetch error for "${query}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    failed,
    queries_processed: queries.length,
    errors: errors.slice(0, 20),
  });
}

// GET — quick status / dry-run showing how many products OFF has for India
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = "https://world.openfoodfacts.org/cgi/search.pl?countries_tags=en:india&json=1&page_size=1&fields=code";
  const res = await fetch(url, {
    headers: { "User-Agent": "Oasis-HealthApp/1.0" },
  });
  const data = await res.json();

  const { count: dbCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({
    off_india_products: data.count || 0,
    db_products: dbCount || 0,
    available_queries: INDIAN_QUERIES.length,
  });
}
