/**
 * Import Open Food Facts India products into Supabase.
 *
 * Usage:
 *   npx tsx scripts/import-off-india.ts
 *
 * Reads the gzipped OFF CSV, filters to India products, maps to our schema,
 * and batch-upserts into the `products` table.
 */

import { createClient } from "@supabase/supabase-js";
import { createReadStream } from "fs";
import { createGunzip } from "zlib";
import { createInterface } from "readline";
import type { ProductCategory } from "../src/lib/database.types";

// --- Config ---
const CSV_PATH =
  process.env.CSV_PATH ||
  "/Users/vansh/Downloads/en.openfoodfacts.org.products.csv.gz";
const BATCH_SIZE = 500;

// --- Category mapping ---
function mapCategory(raw: string): ProductCategory {
  const l = raw.toLowerCase();
  if (/baby/.test(l)) return "baby_food";
  if (/beverage|drink|juice|tea|coffee|water|soda|cola/.test(l)) return "beverage";
  if (/snack|chip|crisp|namkeen|biscuit|cookie|cracker/.test(l)) return "snack";
  if (/dairy|milk|cheese|yogurt|curd|paneer|butter|ghee/.test(l)) return "dairy";
  if (/skincare|skin|cream|lotion|sunscreen/.test(l)) return "skincare";
  if (/hair|shampoo|conditioner/.test(l)) return "haircare";
  if (/cosmetic|makeup|lipstick/.test(l)) return "cosmetic";
  if (/clean|detergent|soap|wash|household/.test(l)) return "household";
  return "food";
}

// --- Parse TSV row (handles quoted fields with tabs) ---
function parseTSV(line: string): string[] {
  return line.split("\t");
}

// --- Main ---
async function main() {
  // Load env
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE env vars in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log(`Reading ${CSV_PATH}...`);

  const stream = createReadStream(CSV_PATH).pipe(createGunzip());
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] = [];
  let colIdx: Record<string, number> = {};
  let batch: any[] = [];
  let total = 0;
  let skipped = 0;
  let inserted = 0;
  let lineNum = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    const { error } = await sb
      .from("products")
      .upsert(batch, { onConflict: "barcode", ignoreDuplicates: false });
    if (error) {
      console.error(`  Batch error (${batch.length} rows):`, error.message);
      // Retry one-by-one to skip bad rows
      let saved = 0;
      for (const row of batch) {
        const { error: e2 } = await sb
          .from("products")
          .upsert(row, { onConflict: "barcode", ignoreDuplicates: false });
        if (!e2) saved++;
      }
      inserted += saved;
      console.error(`  Recovered ${saved}/${batch.length} rows`);
    } else {
      inserted += batch.length;
    }
    batch = [];
  };

  for await (const line of rl) {
    lineNum++;

    if (lineNum === 1) {
      headers = parseTSV(line);
      headers.forEach((h, i) => (colIdx[h] = i));
      continue;
    }

    const cols = parseTSV(line);
    const get = (name: string) => cols[colIdx[name]]?.trim() || "";

    // Filter: must mention India in countries_tags
    const countries = get("countries_tags");
    if (!countries.includes("india")) {
      skipped++;
      continue;
    }

    const barcode = get("code");
    const name = get("product_name") || get("generic_name");
    if (!barcode || !name) {
      skipped++;
      continue;
    }

    const brand = get("brands") || get("brand_owner") || "Unknown";
    const categoryRaw = get("categories_en") || get("main_category_en") || "";
    const ingredientsRaw = get("ingredients_text");
    const ingredients = ingredientsRaw
      ? ingredientsRaw
          .split(/,\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    // Build nutritional_info from available columns
    const nutritional_info: Record<string, number | null> = {};
    for (const key of [
      "energy-kcal_100g",
      "fat_100g",
      "saturated-fat_100g",
      "carbohydrates_100g",
      "sugars_100g",
      "fiber_100g",
      "proteins_100g",
      "salt_100g",
      "sodium_100g",
    ]) {
      const val = get(key);
      if (val) nutritional_info[key.replace("_100g", "")] = parseFloat(val);
    }

    const nutriscore = get("nutriscore_grade")?.toUpperCase();
    const validGrades = ["A", "B", "C", "D", "E"];
    const score_grade = validGrades.includes(nutriscore) ? nutriscore : null;

    batch.push({
      barcode,
      name: name.slice(0, 255),
      brand: brand.slice(0, 255),
      category: mapCategory(categoryRaw),
      image_url: get("image_url") || get("image_small_url") || null,
      ingredients,
      nutritional_info,
      score_grade,
      verified: false,
    });
    total++;

    if (batch.length >= BATCH_SIZE) {
      process.stdout.write(
        `\r  Processed ${total} India products, inserted ${inserted}...`
      );
      await flush();
    }
  }

  await flush();

  console.log(`\n\nDone!`);
  console.log(`  India products found: ${total}`);
  console.log(`  Inserted/updated:     ${inserted}`);
  console.log(`  Skipped (no India/name/barcode): ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
