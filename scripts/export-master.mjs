#!/usr/bin/env node
/**
 * Export all scored products from Supabase into a static master JSON file.
 * This file gets bundled into the Next.js build → zero-cost lookups.
 *
 * Run: node scripts/export-master.mjs
 * Run before every deploy to keep the master sheet fresh.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log("Fetching all products from Supabase...");

  // Supabase returns max 1000 per request, so paginate
  let all = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("barcode,name,brand,category,ingredients,image_url,safety_score,score_grade,analysis,nutritional_info,fssai_license")
      .range(from, from + PAGE - 1);

    if (error) {
      console.error("Fetch error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Fetched ${all.length} total products`);

  // Build the master lookup: barcode → product data
  const master = {};
  let scored = 0;
  let unscored = 0;

  for (const p of all) {
    if (!p.barcode) continue;

    master[p.barcode] = {
      name: p.name,
      brand: p.brand,
      category: p.category,
      ingredients: p.ingredients || [],
      image_url: p.image_url || null,
      safety_score: p.safety_score,
      score_grade: p.score_grade,
      analysis: p.analysis || null,
      nutritional_info: p.nutritional_info || null,
      fssai_license: p.fssai_license || null,
    };

    if (p.safety_score !== null) scored++;
    else unscored++;
  }

  // Also build a name-based index for search (name+brand → barcode)
  const searchIndex = [];
  for (const [barcode, p] of Object.entries(master)) {
    searchIndex.push({
      b: barcode,
      n: p.name?.toLowerCase() || "",
      br: p.brand?.toLowerCase() || "",
      s: p.safety_score,
      g: p.score_grade,
    });
  }

  const output = {
    generated_at: new Date().toISOString(),
    total: all.length,
    scored,
    unscored,
    products: master,
    search_index: searchIndex,
  };

  // Write to src/data/ so it gets bundled at build time
  const dir = resolve(process.cwd(), "src/data");
  mkdirSync(dir, { recursive: true });

  const filePath = resolve(dir, "master-products.json");
  writeFileSync(filePath, JSON.stringify(output));

  // Also write a minified version for the client
  const clientData = {};
  for (const [barcode, p] of Object.entries(master)) {
    if (p.safety_score === null) continue; // Only include scored products
    clientData[barcode] = {
      n: p.name,
      b: p.brand,
      c: p.category,
      s: p.safety_score,
      g: p.score_grade,
      i: p.image_url,
    };
  }

  const clientPath = resolve(process.cwd(), "public/data");
  mkdirSync(clientPath, { recursive: true });
  writeFileSync(
    resolve(clientPath, "scores.json"),
    JSON.stringify(clientData)
  );

  const masterSize = (JSON.stringify(output).length / 1024).toFixed(0);
  const clientSize = (JSON.stringify(clientData).length / 1024).toFixed(0);

  console.log(`\nMaster file: src/data/master-products.json (${masterSize} KB)`);
  console.log(`  → ${scored} scored, ${unscored} unscored`);
  console.log(`Client file: public/data/scores.json (${clientSize} KB)`);
  console.log(`  → ${Object.keys(clientData).length} scored products for instant client lookup`);
  console.log(`\nDone! Commit and deploy to update the live app.`);
}

main().catch(console.error);
