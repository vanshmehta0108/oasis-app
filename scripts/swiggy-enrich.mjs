#!/usr/bin/env node
/**
 * swiggy-enrich.mjs
 *
 * Pulls ingredient + nutritional data from Swiggy Instamart for products
 * in our Supabase DB that are missing ingredients or images.
 *
 * Prerequisites:
 *   1. SWIGGY_API_KEY set in your environment (from Builders Club approval)
 *   2. SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL set
 *
 * Usage:
 *   SWIGGY_API_KEY=xxx node scripts/swiggy-enrich.mjs
 *   SWIGGY_API_KEY=xxx node scripts/swiggy-enrich.mjs --dry-run
 *   SWIGGY_API_KEY=xxx node scripts/swiggy-enrich.mjs --limit=500
 *   SWIGGY_API_KEY=xxx node scripts/swiggy-enrich.mjs --category=snack
 */

import { createClient } from "@supabase/supabase-js";
import { setTimeout as sleep } from "timers/promises";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ── Config ─────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\\n/g, "").trim();
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/\\n/g, "").trim();
const SWIGGY_KEY   = process.env.SWIGGY_API_KEY?.trim();
const SWIGGY_BASE  = "https://api.swiggy.com/v1"; // confirm from docs post-approval

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes("--dry-run");
const LIMIT       = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "200");
const CATEGORY    = args.find((a) => a.startsWith("--category="))?.split("=")[1];
const CONCURRENCY = 3;   // parallel Swiggy requests
const DELAY_MS    = 400; // between batches — stay within rate limits
const CHECKPOINT  = ".swiggy-enrich-checkpoint.json";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  SUPABASE env vars missing");
  process.exit(1);
}
if (!SWIGGY_KEY) {
  console.error("❌  SWIGGY_API_KEY not set. Apply at https://mcp.swiggy.com/builders/");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ── Checkpoint ─────────────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT)) return { processed: [], enriched: 0, failed: 0 };
  return JSON.parse(readFileSync(CHECKPOINT, "utf-8"));
}

function saveCheckpoint(cp) {
  writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2));
}

// ── Swiggy helpers ─────────────────────────────────────────────────────────────

async function swiggyGet(path, params = {}) {
  const url = new URL(`${SWIGGY_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${SWIGGY_KEY}`,
      "Content-Type": "application/json",
      "X-Client-ID": "sift",
    },
  });

  if (res.status === 429) {
    const retry = parseInt(res.headers.get("retry-after") ?? "5");
    console.log(`  ⏳  Rate limited — waiting ${retry}s`);
    await sleep(retry * 1000);
    return swiggyGet(path, params); // one retry
  }

  if (!res.ok) throw new Error(`Swiggy ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchByBarcode(barcode) {
  try {
    const data = await swiggyGet(`/instamart/products/barcode/${barcode}`);
    return data?.product ?? data?.data ?? null;
  } catch {
    return null;
  }
}

async function fetchByName(name, brand) {
  try {
    const q = brand && brand !== "Unknown Brand" ? `${brand} ${name}` : name;
    const data = await swiggyGet("/instamart/products/search", { q, limit: 3 });
    const items = data?.products ?? data?.items ?? data?.results ?? [];
    if (!items.length) return null;

    // Best match: brand similarity
    return (
      items.find((p) =>
        brand &&
        p.brand?.toLowerCase().includes(brand.toLowerCase().slice(0, 5)),
      ) ?? items[0]
    );
  } catch {
    return null;
  }
}

function extractIngredients(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.ingredients)) return raw.ingredients.filter(Boolean);
  if (typeof raw.ingredients === "string") {
    return raw.ingredients.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  }
  if (raw.description && typeof raw.description === "string") {
    const m = raw.description.match(/ingredients?[:\-]\s*(.+?)(?:\.|allergen|contains)/i);
    if (m?.[1]) return m[1].split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const cp = loadCheckpoint();
  console.log(`\n🍊  Swiggy Instamart Enrichment${DRY_RUN ? " [DRY RUN]" : ""}`);
  console.log(`   Already processed: ${cp.processed.length} | enriched: ${cp.enriched} | failed: ${cp.failed}\n`);

  // Fetch products from Supabase that need enrichment
  let query = supabase
    .from("products")
    .select("id, barcode, name, brand, category, ingredients, image_url")
    .filter("barcode", "not.like", "manual-%")
    .not("barcode", "in", `(${cp.processed.length > 0 ? cp.processed.join(",") : "''"})`);

  if (CATEGORY) query = query.eq("category", CATEGORY);

  // Prioritize: missing ingredients OR missing image
  query = query.or("ingredients.eq.{},image_url.is.null");
  query = query.limit(LIMIT);

  const { data: products, error } = await query;
  if (error) { console.error("Supabase fetch error:", error.message); process.exit(1); }
  if (!products?.length) { console.log("✅  Nothing to enrich."); return; }

  console.log(`📦  ${products.length} products to enrich\n`);

  let enriched = 0, failed = 0, skipped = 0;

  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (product) => {
      process.stdout.write(`  [${i + 1}/${products.length}] ${product.name?.slice(0, 40).padEnd(40)} → `);

      const raw = product.barcode
        ? (await fetchByBarcode(product.barcode)) ?? (await fetchByName(product.name, product.brand))
        : await fetchByName(product.name, product.brand);

      if (!raw) {
        process.stdout.write("not found\n");
        failed++;
        cp.processed.push(product.barcode ?? product.id);
        return;
      }

      const ingredients = extractIngredients(raw);
      const imageUrl    = raw.image_url ?? raw.image ?? raw.thumbnail ?? null;
      const price       = raw.price ?? raw.selling_price ?? null;

      const hasNewIngredients = ingredients.length > 0 && product.ingredients?.length === 0;
      const hasNewImage       = imageUrl && !product.image_url;

      if (!hasNewIngredients && !hasNewImage) {
        process.stdout.write("already complete\n");
        skipped++;
        cp.processed.push(product.barcode ?? product.id);
        return;
      }

      process.stdout.write(`${ingredients.length} ingredients, image: ${hasNewImage ? "✓" : "-"}, price: ${price ? "₹" + price : "-"}\n`);

      if (!DRY_RUN) {
        const update = {};
        if (hasNewIngredients) update.ingredients = ingredients;
        if (hasNewImage) update.image_url = imageUrl;
        // Store Swiggy price in analysis JSONB for the compare page
        if (price) update.analysis = { ...((product.analysis) ?? {}), swiggy_price: price };

        const { error: updateErr } = await supabase
          .from("products")
          .update(update)
          .eq("id", product.id);

        if (updateErr) {
          console.error(`    ⚠️  Update failed: ${updateErr.message}`);
          failed++;
        } else {
          enriched++;
          cp.enriched++;
        }
      } else {
        enriched++;
      }

      cp.processed.push(product.barcode ?? product.id);
    }));

    saveCheckpoint({ ...cp, enriched: cp.enriched + enriched, failed: cp.failed + failed });
    await sleep(DELAY_MS);
  }

  console.log(`\n✅  Done — enriched: ${enriched}, skipped: ${skipped}, failed: ${failed}`);
  if (DRY_RUN) console.log("   (dry run — no DB writes made)");
}

main().catch((err) => { console.error(err); process.exit(1); });
