#!/usr/bin/env node
/**
 * Import scraped BigBasket JSONL into Supabase.
 * Upserts by barcode (BigBasket SKU). Parses ingredients text into array.
 * Stores all_images inside analysis JSONB for vision extraction later.
 *
 * Usage:
 *   node scripts/bb-import.mjs                         # import data/bigbasket-products.jsonl
 *   node scripts/bb-import.mjs --file data/bigbasket-products.jsonl
 *   node scripts/bb-import.mjs --resume
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESUME      = process.argv.includes('--resume');
const FILE_ARG    = process.argv.find(a => a.startsWith('--file='))?.split('=')[1];
const JSONL_FILE  = FILE_ARG || path.join(__dirname, '../data/bigbasket-products.jsonl');
const CP_FILE     = path.join(__dirname, '.bb-import-checkpoint.json');
const BATCH_SIZE  = 100;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function loadCheckpoint() {
  if (!fs.existsSync(CP_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CP_FILE, 'utf8')); } catch { return null; }
}
function saveCheckpoint(d) { fs.writeFileSync(CP_FILE, JSON.stringify(d, null, 2)); }

function parseIngredients(text) {
  if (!text || text.trim().length < 3) return [];
  return text
    .split(/[,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 1 && s.length < 200)
    .slice(0, 200);
}

const BB_CATEGORY_MAP = {
  'beverages':                 'beverage',
  'water':                     'water',
  'dairy-bread-eggs':          'dairy',
  'snacks-branded-foods':      'snack',
  'food-grains-oil-masala':    'food',
  'fruits-vegetables':         'food',
  'bakery-cakes-dairy':        'food',
  'eggs-meat-fish':            'food',
  'gourmet-world-food':        'food',
  'organic':                   'food',
  'baby-care':                 'skincare',
  'beauty-hygiene':            'skincare',
  'health-beauty':             'skincare',
  'personal-care':             'skincare',
  'healthcare':                'skincare',
  'pet-care':                  'food',
  'cleaning-household':        'skincare',
};

function mapCategory(raw) {
  if (!raw) return 'food';
  const slug = raw.toLowerCase().trim();
  if (BB_CATEGORY_MAP[slug]) return BB_CATEGORY_MAP[slug];
  if (slug.includes('drink') || slug.includes('juice') || slug.includes('beverage')) return 'beverage';
  if (slug.includes('snack') || slug.includes('chip') || slug.includes('biscuit')) return 'snack';
  if (slug.includes('dairy') || slug.includes('milk') || slug.includes('cheese')) return 'dairy';
  if (slug.includes('skin') || slug.includes('beauty') || slug.includes('care') || slug.includes('hygiene')) return 'skincare';
  return 'food';
}

function mapProduct(raw) {
  const ingredients = parseIngredients(raw.ingredients_text);

  const analysis = {};
  if (raw.all_images?.length > 0) analysis.all_images = raw.all_images;
  if (raw.sku) analysis.bb_sku = raw.sku;
  if (raw.nutritional_text) analysis.nutritional_text = raw.nutritional_text;

  const row = {
    barcode:    raw.sku || raw.ean || '',
    name:       (raw.name || '').slice(0, 500),
    brand:      (raw.brand || '').slice(0, 200),
    category:   mapCategory(raw.category),
    image_url:  raw.image_url || '',
    source:     'bigbasket',
    updated_at: new Date().toISOString(),
  };

  row.ingredients = ingredients.length > 0 ? ingredients : [];
  if (raw.fssai_license) row.fssai_license = raw.fssai_license;
  if (Object.keys(raw.nutrition || {}).length > 0) row.nutritional_info = raw.nutrition;
  if (Object.keys(analysis).length > 0) row.analysis = analysis;

  return row;
}

async function upsertBatch(rows) {
  const { error } = await sb
    .from('products')
    .upsert(rows, { onConflict: 'barcode', ignoreDuplicates: false });
  if (error) throw new Error(error.message);
}

async function main() {
  console.log('Sift — bb-import.mjs');
  console.log(`File: ${JSONL_FILE}`);
  console.log(`Resume: ${RESUME}\n`);

  if (!fs.existsSync(JSONL_FILE)) {
    console.error(`File not found: ${JSONL_FILE}`);
    process.exit(1);
  }

  const cp       = RESUME ? loadCheckpoint() : null;
  let skipLines  = cp?.linesProcessed || 0;
  let imported   = cp?.imported || 0;
  let skipped    = cp?.skipped  || 0;
  let failed     = cp?.failed   || 0;
  let lineNum    = 0;
  let batch      = [];

  const startTime = Date.now();
  let lastCp = Date.now();

  const rl = readline.createInterface({
    input: fs.createReadStream(JSONL_FILE),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNum++;
    if (line.trim().length === 0) continue;
    if (lineNum <= skipLines) continue;

    let raw;
    try {
      raw = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }

    if (!raw.name || raw.name.trim().length === 0) { skipped++; continue; }
    if (!raw.sku && !raw.ean) { skipped++; continue; }

    batch.push(mapProduct(raw));

    if (batch.length >= BATCH_SIZE) {
      try {
        await upsertBatch(batch);
        imported += batch.length;
      } catch (e) {
        console.error(`  [batch error] line ${lineNum}: ${e.message}`);
        failed += batch.length;
      }
      batch = [];

      const elapsed = (Date.now() - startTime) / 60000;
      const rate    = elapsed > 0 ? (imported / elapsed).toFixed(0) : '?';
      process.stdout.write(`  [${lineNum}] imported: ${imported} | skipped: ${skipped} | failed: ${failed} | ${rate}/min\n`);
    }

    if (Date.now() - lastCp > 30_000) {
      saveCheckpoint({ linesProcessed: lineNum, imported, skipped, failed });
      lastCp = Date.now();
    }
  }

  // flush remaining
  if (batch.length > 0) {
    try {
      await upsertBatch(batch);
      imported += batch.length;
    } catch (e) {
      console.error(`  [final batch error]: ${e.message}`);
      failed += batch.length;
    }
  }

  saveCheckpoint({ linesProcessed: lineNum, imported, skipped, failed, done: true });
  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\nDone in ${elapsed} min`);
  console.log(`  Imported : ${imported}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Failed   : ${failed}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
