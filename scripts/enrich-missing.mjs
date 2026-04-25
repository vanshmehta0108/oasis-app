#!/usr/bin/env node
/**
 * Enrich unscored products in Supabase by fetching ingredient data from the
 * Open Food Facts API. Targets products where ingredients = '{}' (empty array).
 *
 * Usage:
 *   node scripts/enrich-missing.mjs            # fresh start
 *   node scripts/enrich-missing.mjs --resume   # resume from checkpoint
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESUME      = process.argv.includes('--resume');

const BATCH_SIZE        = 100;   // products fetched from Supabase per page
const RATE_LIMIT_MS     = 334;   // ~3 req/s (1000ms / 3)
const PROGRESS_INTERVAL = 50;    // print progress every N products
const CHECKPOINT_MS     = 30_000; // save checkpoint every 30 seconds
const MAX_INGREDIENTS   = 200;

const CHECKPOINT_FILE = path.join(__dirname, '.enrich-checkpoint.json');
const OFF_BASE_URL    = 'https://world.openfoodfacts.org/api/v2/product';

// ─── Validate env ─────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// ─── Supabase client ──────────────────────────────────────────────────────────

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Checkpoint helpers ───────────────────────────────────────────────────────

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

let lastRequestAt = 0;

async function rateLimitedFetch(url) {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestAt = Date.now();

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Sift-India-Enricher/1.0 (contact@sift.app)' },
    signal: AbortSignal.timeout(10_000),
  });
  return res;
}

// ─── OFF API ──────────────────────────────────────────────────────────────────

async function fetchOFF(barcode) {
  const url = `${OFF_BASE_URL}/${encodeURIComponent(barcode)}.json?fields=ingredients_text,ingredients_tags,image_url`;
  try {
    const res = await rateLimitedFetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    return json.product;
  } catch (err) {
    // timeout or network error — treat as not found
    console.error(`  OFF fetch error for ${barcode}: ${err.message}`);
    return null;
  }
}

// ─── Parse ingredients ────────────────────────────────────────────────────────

function parseIngredients(ingredientsText) {
  if (!ingredientsText || typeof ingredientsText !== 'string') return [];
  return ingredientsText
    .split(/[,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, MAX_INGREDIENTS);
}

// ─── Count total unenriched products ─────────────────────────────────────────

async function countUnenriched() {
  const { count, error } = await sb
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('ingredients', '{}')
    .not('barcode', 'is', null);

  if (error) {
    console.error('Failed to count unenriched products:', error.message);
    return 0;
  }
  return count ?? 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Sift — enrich-missing.mjs');
  console.log(`Resume mode: ${RESUME ? 'ON' : 'OFF'}`);
  console.log('Counting unenriched products...');

  const total = await countUnenriched();
  console.log(`Total unenriched: ${total}`);

  if (total === 0) {
    console.log('Nothing to enrich. Exiting.');
    return;
  }

  // ─── Load or init stats ───────────────────────────────────────────────────

  let processed = 0;
  let enriched  = 0;
  let skipped   = 0;
  /** @type {Set<string>} barcodes already processed (for resume) */
  const processedBarcodes = new Set();

  if (RESUME) {
    const cp = loadCheckpoint();
    if (cp) {
      processed = cp.processed ?? 0;
      enriched  = cp.enriched  ?? 0;
      skipped   = cp.skipped   ?? 0;
      (cp.processedBarcodes ?? []).forEach(b => processedBarcodes.add(b));
      console.log(`Resuming from checkpoint — processed: ${processed}, enriched: ${enriched}, skipped: ${skipped}`);
    } else {
      console.log('--resume specified but no checkpoint found. Starting fresh.');
    }
  }

  // ─── Checkpoint timer ─────────────────────────────────────────────────────

  let lastCheckpointAt = Date.now();

  function maybeCheckpoint() {
    if (Date.now() - lastCheckpointAt >= CHECKPOINT_MS) {
      saveCheckpoint({
        processed,
        enriched,
        skipped,
        processedBarcodes: [...processedBarcodes],
        savedAt: new Date().toISOString(),
      });
      lastCheckpointAt = Date.now();
      console.log(`  [checkpoint saved] processed=${processed} enriched=${enriched} skipped=${skipped}`);
    }
  }

  // ─── Cursor-paginated loop ────────────────────────────────────────────────

  let offset = 0;
  let exhausted = false;

  while (!exhausted) {
    const { data: rows, error } = await sb
      .from('products')
      .select('id, barcode, name')
      .eq('ingredients', '{}')
      .not('barcode', 'is', null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`Supabase query error at offset ${offset}:`, error.message);
      break;
    }

    if (!rows || rows.length === 0) {
      exhausted = true;
      break;
    }

    for (const row of rows) {
      const barcode = row.barcode;

      // Skip if already processed (resume mode)
      if (processedBarcodes.has(barcode)) {
        processed++;
        continue;
      }

      // ── Fetch from OFF ──
      const product = await fetchOFF(barcode);

      if (!product || !product.ingredients_text) {
        console.log(`  [not found] ${barcode} — ${row.name ?? '(no name)'}`);
        skipped++;
      } else {
        const ingredients = parseIngredients(product.ingredients_text);

        if (ingredients.length === 0) {
          console.log(`  [empty parse] ${barcode} — "${product.ingredients_text.slice(0, 60)}"`);
          skipped++;
        } else {
          // Build update payload
          const update = { ingredients };
          if (product.image_url) update.image_url = product.image_url;

          const { error: updateErr } = await sb
            .from('products')
            .update(update)
            .eq('id', row.id);

          if (updateErr) {
            console.error(`  [update error] ${barcode}: ${updateErr.message}`);
            skipped++;
          } else {
            enriched++;
          }
        }
      }

      processed++;
      processedBarcodes.add(barcode);

      // Progress log every PROGRESS_INTERVAL products
      if (processed % PROGRESS_INTERVAL === 0) {
        console.log(`[${processed}/${total}] Enriched: ${enriched}, Skipped: ${skipped}`);
      }

      maybeCheckpoint();
    }

    // If the page was smaller than BATCH_SIZE, we've reached the end.
    // But because we're updating rows as we go, the offset must stay at 0
    // since enriched rows will no longer match the .eq('ingredients','{}') filter.
    // We do NOT advance the offset — the query always returns the next un-enriched page.
    if (rows.length < BATCH_SIZE) {
      exhausted = true;
    }
  }

  // ─── Final checkpoint ─────────────────────────────────────────────────────

  saveCheckpoint({
    processed,
    enriched,
    skipped,
    processedBarcodes: [...processedBarcodes],
    savedAt: new Date().toISOString(),
    done: true,
  });

  // ─── Summary ──────────────────────────────────────────────────────────────

  console.log('\n───────────────────────────────────────────');
  console.log('Enrichment complete.');
  console.log(`  Total processed : ${processed}`);
  console.log(`  Enriched        : ${enriched}`);
  console.log(`  Skipped (no data): ${skipped}`);
  console.log(`  Checkpoint saved: ${CHECKPOINT_FILE}`);
  console.log('───────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
