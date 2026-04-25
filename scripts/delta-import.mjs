#!/usr/bin/env node
/**
 * Import Indian products from OFF daily delta files (last 14 days).
 * Much faster than full dump — each file is ~30MB vs 12GB.
 * Catches recently added/updated products not yet in DB.
 *
 * Usage: node scripts/delta-import.mjs
 */

import fs from 'fs';
import https from 'https';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE   = 100;
const DELTA_BASE   = 'https://static.openfoodfacts.org/data/delta/';
const DELTA_DIR    = path.join(__dirname, '.deltas');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
        file.close();
        resolve(download(res.headers.location, dest));
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function mapCategory(tags, name = '') {
  const h = (Array.isArray(tags) ? tags.join(' ') : String(tags || '')) + ' ' + name;
  const l = h.toLowerCase();
  if (/baby/.test(l))                                                          return 'baby_food';
  if (/water/.test(l))                                                         return 'water';
  if (/beverage|drink|juice|tea|coffee|soda|cola|lassi/.test(l))              return 'beverage';
  if (/snack|chip|crisp|namkeen|biscuit|cookie|cracker|wafer/.test(l))        return 'snack';
  if (/dairy|milk|cheese|yogurt|curd|paneer|butter|ghee/.test(l))             return 'dairy';
  if (/shampoo|conditioner|hair/.test(l))                                      return 'haircare';
  if (/skin.?care|cream|lotion|sunscreen|moisturis|face.?wash/.test(l))       return 'skincare';
  if (/cosmetic|makeup|lipstick|mascara|beauty/.test(l))                       return 'cosmetic';
  if (/soap|hand.?wash|body.?wash|clean|detergent|dishwash|household|laundry/.test(l)) return 'household';
  return 'food';
}

async function processFile(filePath) {
  const stream = fs.createReadStream(filePath).pipe(createGunzip());
  const rl     = createInterface({ input: stream, crlfDelay: Infinity });

  let batch = [];
  let inserted = 0;

  const flush = async () => {
    if (!batch.length) return;
    const { error } = await sb.from('products').upsert(batch, { onConflict: 'barcode', ignoreDuplicates: false });
    if (error) {
      for (const row of batch) {
        const { error: e2 } = await sb.from('products').upsert(row, { onConflict: 'barcode', ignoreDuplicates: false });
        if (!e2) inserted++;
      }
    } else {
      inserted += batch.length;
    }
    batch = [];
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    let p;
    try { p = JSON.parse(line); } catch { continue; }

    const barcode = p.code?.toString().trim();
    const name    = (p.product_name || p.generic_name || '').trim();
    if (!barcode || !name) continue;

    const isIndia = p.countries_tags?.includes('en:india') || barcode.startsWith('890');
    if (!isIndia) continue;

    const brand = (p.brands || p.brand_owner || 'Unknown').split(',')[0].trim().slice(0, 255);
    const ingredients = (p.ingredients_text || '').split(/,\s*/).map(s => s.trim()).filter(Boolean).slice(0, 100);

    const n = p.nutriments || {};
    const ni = {};
    for (const [k, v] of Object.entries({
      'energy-kcal_100g': 'energy_kcal', 'fat_100g': 'fat',
      'saturated-fat_100g': 'saturated_fat', 'carbohydrates_100g': 'carbohydrates',
      'sugars_100g': 'sugars', 'fiber_100g': 'fiber',
      'proteins_100g': 'proteins', 'salt_100g': 'salt',
    })) { if (n[k] != null) ni[v] = parseFloat(n[k]); }

    const rawGrade = p.nutriscore_grade?.toUpperCase();
    batch.push({
      barcode,
      name: name.slice(0, 255),
      brand,
      category: mapCategory(p.categories_tags, name),
      image_url: p.image_url || p.image_small_url || null,
      ingredients,
      nutritional_info: Object.keys(ni).length ? ni : {},
      score_grade: ['A','B','C','D','E'].includes(rawGrade) ? rawGrade : null,
      verified: false,
    });

    if (batch.length >= BATCH_SIZE) await flush();
  }

  await flush();
  return inserted;
}

async function main() {
  console.log('═══ Sift Delta Import ═══');
  fs.mkdirSync(DELTA_DIR, { recursive: true });

  const res = await new Promise((resolve, reject) => {
    https.get(DELTA_BASE + 'index.txt', (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => resolve(data.trim().split('\n').filter(Boolean)));
    }).on('error', reject);
  });

  console.log(`Found ${res.length} delta files\n`);

  let totalInserted = 0;

  for (const filename of res) {
    const dest = path.join(DELTA_DIR, filename);
    if (!fs.existsSync(dest)) {
      process.stdout.write(`Downloading ${filename} (~30MB)... `);
      await download(DELTA_BASE + filename, dest);
      console.log('done');
    } else {
      console.log(`Using cached ${filename}`);
    }

    process.stdout.write(`Processing ${filename}... `);
    const count = await processFile(dest);
    console.log(`+${count} products`);
    totalInserted += count;
  }

  console.log(`\n✓ Delta import complete. Total upserted: ${totalInserted.toLocaleString()}`);
}

main().catch(console.error);
