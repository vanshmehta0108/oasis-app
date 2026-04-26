#!/usr/bin/env node
/**
 * Import Indian products from the OFF full CSV export.
 * Streams the 12GB TSV file line-by-line — no memory issues.
 * Filters: countries_tags contains 'india' OR barcode starts with '890'.
 *
 * Usage: node scripts/csv-import.mjs
 */

import fs from 'fs';
import { createInterface } from 'readline';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_PATH     = path.join(__dirname, '../Oasis- Health App for india /en.openfoodfacts.org.products 2.csv');
const BATCH_SIZE   = 100;
const CHECKPOINT_FILE = path.join(__dirname, '.csv-checkpoint.json');
const CHECKPOINT_EVERY = 30_000; // ms

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const RESUME = process.argv.includes('--resume');
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function loadCheckpoint() {
  if (RESUME && fs.existsSync(CHECKPOINT_FILE)) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    console.log(`Resuming from line ${cp.linesProcessed.toLocaleString()}, ${cp.totalInserted.toLocaleString()} inserted so far`);
    return cp;
  }
  return { linesProcessed: 0, totalInserted: 0 };
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp));
}

function mapCategory(categoriesTags, name = '') {
  const h = (categoriesTags || '') + ' ' + name.toLowerCase();
  if (/baby/.test(h))                                                          return 'baby_food';
  if (/water/.test(h))                                                         return 'water';
  if (/beverage|drink|juice|tea|coffee|soda|cola|lassi/.test(h))              return 'beverage';
  if (/snack|chip|crisp|namkeen|biscuit|cookie|cracker|wafer/.test(h))        return 'snack';
  if (/dairy|milk|cheese|yogurt|curd|paneer|butter|ghee/.test(h))             return 'dairy';
  if (/shampoo|conditioner|hair/.test(h))                                      return 'haircare';
  if (/skin.?care|cream|lotion|sunscreen|moisturis|face.?wash/.test(h))       return 'skincare';
  if (/cosmetic|makeup|lipstick|mascara|beauty/.test(h))                       return 'cosmetic';
  if (/soap|hand.?wash|body.?wash|detergent|dishwash|household|laundry/.test(h)) return 'household';
  return 'food';
}

async function main() {
  console.log('═══ Sift CSV Import ═══');
  console.log(`Source: ${CSV_PATH}`);
  console.log(`Mode: ${RESUME ? 'RESUME' : 'FRESH'}\n`);

  const cp = loadCheckpoint();
  let lineNum = 0;
  let headers = null;
  let batch = [];
  let sessionInserted = 0;
  let lastCheckpoint = Date.now();

  const flush = async () => {
    if (!batch.length) return;
    const { error } = await sb.from('products').upsert(batch, { onConflict: 'barcode', ignoreDuplicates: true });
    if (error) {
      for (const row of batch) {
        const { error: e2 } = await sb.from('products').upsert(row, { onConflict: 'barcode', ignoreDuplicates: true });
        if (!e2) sessionInserted++;
      }
    } else {
      sessionInserted += batch.length;
    }
    batch = [];
  };

  const rl = createInterface({
    input: fs.createReadStream(CSV_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNum++;

    // First line is headers
    if (lineNum === 1) {
      headers = line.split('\t');
      continue;
    }

    // Skip already-processed lines when resuming
    if (lineNum <= cp.linesProcessed) {
      if (lineNum % 500_000 === 0) process.stdout.write(`\r  Skipping: ${lineNum.toLocaleString()}/${cp.linesProcessed.toLocaleString()}   `);
      continue;
    }

    const cols = line.split('\t');
    const get  = (name) => cols[headers.indexOf(name)]?.trim() || '';

    const barcode = get('code');
    const name    = get('product_name') || get('generic_name');
    if (!barcode || !name) continue;

    const countriesTags = get('countries_tags');
    const isIndia = countriesTags.includes('en:india') || barcode.startsWith('890');
    if (!isIndia) continue;

    const brand = (get('brands') || get('brand_owner') || 'Unknown').split(',')[0].trim().slice(0, 255);
    const ingredientsRaw = get('ingredients_text');
    const ingredients = ingredientsRaw
      ? ingredientsRaw.split(/,\s*/).map(s => s.trim()).filter(Boolean).slice(0, 100)
      : [];

    const ni = {};
    for (const [col, key] of [
      ['energy-kcal_100g', 'energy_kcal'],
      ['fat_100g', 'fat'],
      ['saturated-fat_100g', 'saturated_fat'],
      ['carbohydrates_100g', 'carbohydrates'],
      ['sugars_100g', 'sugars'],
      ['fiber_100g', 'fiber'],
      ['proteins_100g', 'proteins'],
      ['salt_100g', 'salt'],
    ]) {
      const val = parseFloat(get(col));
      if (!isNaN(val)) ni[key] = val;
    }

    const rawGrade = get('nutriscore_grade').toUpperCase();
    const imageUrl = get('image_url') || get('image_small_url') || null;

    batch.push({
      barcode,
      name: name.slice(0, 255),
      brand,
      category: mapCategory(get('categories_tags'), name),
      image_url: imageUrl,
      ingredients,
      nutritional_info: Object.keys(ni).length ? ni : {},
      score_grade: ['A','B','C','D','E'].includes(rawGrade) ? rawGrade : null,
      verified: false,
    });

    if (batch.length >= BATCH_SIZE) {
      await flush();

      const now = Date.now();
      if (now - lastCheckpoint > CHECKPOINT_EVERY) {
        cp.linesProcessed = lineNum;
        cp.totalInserted += sessionInserted;
        sessionInserted = 0;
        saveCheckpoint(cp);
        lastCheckpoint = now;
      }

      process.stdout.write(
        `\r  Line ${lineNum.toLocaleString()} | Session +${sessionInserted.toLocaleString()} | Total ${(cp.totalInserted + sessionInserted).toLocaleString()}   `
      );
    }
  }

  await flush();
  cp.totalInserted += sessionInserted;
  saveCheckpoint(cp);

  console.log(`\n\n✓ Done. Total products upserted: ${cp.totalInserted.toLocaleString()}`);
  fs.unlinkSync(CHECKPOINT_FILE);
}

main().catch(console.error);
