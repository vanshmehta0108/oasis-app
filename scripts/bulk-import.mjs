#!/usr/bin/env node
/**
 * Bulk import Indian products from OpenFoodFacts + OpenBeautyFacts into Supabase.
 * Streams JSONL dumps (no API rate limits), filters for India, upserts in batches.
 * Supports checkpoint/resume — safe to Ctrl+C and restart at any time.
 *
 * Usage:
 *   node scripts/bulk-import.mjs            # fresh start
 *   node scripts/bulk-import.mjs --resume   # resume from checkpoint
 *   node scripts/bulk-import.mjs --dry-run  # test without DB writes
 */

import fs from 'fs';
import https from 'https';
import http from 'http';
import { createGunzip } from 'zlib';
import { createInterface } from 'readline';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN     = process.argv.includes('--dry-run');
const RESUME      = process.argv.includes('--resume');

const BATCH_SIZE        = 100;
const CHECKPOINT_FILE   = path.join(__dirname, '.import-checkpoint.json');
const CHECKPOINT_EVERY  = 30_000; // ms
const RETRY_DELAY       = 30_000; // ms before restarting after fatal error
const MAX_RETRIES       = 999;    // effectively infinite

const SOURCES = [
  {
    name: 'openfoodfacts',
    // Direct S3 URL (static.openfoodfacts.org redirects to this)
    url:  'https://openfoodfacts-ds.s3.eu-west-3.amazonaws.com/openfoodfacts-products.jsonl.gz',
    dump: path.join(__dirname, '.off-dump.jsonl.gz'),
  },
  {
    name: 'openbeautyfacts',
    url:  'https://static.openbeautyfacts.org/data/openbeautyfacts-products.jsonl.gz',
    dump: path.join(__dirname, '.obf-dump.jsonl.gz'),
  },
];

// ─── Checkpoint ───────────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (RESUME && fs.existsSync(CHECKPOINT_FILE)) {
    try {
      const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
      console.log(`Resuming: source ${cp.sourceIndex} (${SOURCES[cp.sourceIndex]?.name}), line ${cp.linesProcessed.toLocaleString()}, ${cp.totalInserted.toLocaleString()} inserted so far`);
      return cp;
    } catch {}
  }
  return { sourceIndex: 0, linesProcessed: 0, totalInserted: 0 };
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ─── Download with resume ─────────────────────────────────────────────────────

function getContentLength(url, redirects = 5) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    mod.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'HEAD' }, (res) => {
      if ([301,302,307,308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        resolve(getContentLength(res.headers.location, redirects - 1));
      } else {
        resolve(parseInt(res.headers['content-length'] || '0', 10));
      }
    }).on('error', () => resolve(0)).end();
  });
}

async function downloadFile(url, dest) {
  const existingSize = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
  const totalSize    = await getContentLength(url);

  if (totalSize > 0 && existingSize >= totalSize) {
    console.log(`  Dump already complete (${(existingSize / 1e9).toFixed(2)} GB)`);
    return;
  }

  const fromByte = existingSize;
  if (fromByte > 0) {
    console.log(`  Resuming download from ${(fromByte / 1e6).toFixed(0)} MB / ${(totalSize / 1e6).toFixed(0)} MB...`);
  } else {
    console.log(`  Downloading ${totalSize > 0 ? (totalSize / 1e9).toFixed(2) + ' GB' : '(unknown size)'}...`);
  }

  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const reqHeaders = fromByte > 0 ? { Range: `bytes=${fromByte}-` } : {};

    const req = mod.get(
      { hostname: u.hostname, path: u.pathname + u.search, headers: reqHeaders },
      (res) => {
        if (res.statusCode === 416) { resolve(); return; } // already complete
        // Follow redirects (but without Range header — restart from 0)
        if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
          req.destroy();
          resolve(downloadFile(res.headers.location, dest));
          return;
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(dest, { flags: fromByte > 0 ? 'a' : 'w' });
        let downloaded = fromByte;
        let lastLog    = Date.now();

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          if (Date.now() - lastLog > 5000) {
            const pct = totalSize > 0 ? ` (${(downloaded / totalSize * 100).toFixed(1)}%)` : '';
            process.stdout.write(`\r  ${(downloaded / 1e9).toFixed(2)} GB${pct}   `);
            lastLog = Date.now();
          }
        });

        res.pipe(file);
        file.on('finish', () => { file.close(); process.stdout.write('\n'); resolve(); });
        file.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

// ─── Category mapping ─────────────────────────────────────────────────────────

const VALID_CATEGORIES = ['food','beverage','snack','dairy','baby_food','skincare','haircare','cosmetic','household','water'];

function mapCategory(tags, name = '') {
  const haystack = (Array.isArray(tags) ? tags.join(' ') : String(tags || '')) + ' ' + name;
  const l = haystack.toLowerCase();
  if (/baby/.test(l))                                              return 'baby_food';
  if (/water/.test(l))                                             return 'water';
  if (/beverage|drink|juice|tea|coffee|soda|cola|lassi/.test(l))  return 'beverage';
  if (/snack|chip|crisp|namkeen|biscuit|cookie|cracker|wafer/.test(l)) return 'snack';
  if (/dairy|milk|cheese|yogurt|curd|paneer|butter|ghee/.test(l)) return 'dairy';
  if (/shampoo|conditioner|hair/.test(l))                                        return 'haircare';
  if (/skin.?care|cream|lotion|sunscreen|moisturis|face.?wash/.test(l))         return 'skincare';
  if (/cosmetic|makeup|lipstick|mascara|beauty/.test(l))                        return 'cosmetic';
  if (/soap|hand.?wash|body.?wash|clean|detergent|dishwash|household|laundry/.test(l)) return 'household';
  return 'food';
}

// ─── Process one JSONL source ─────────────────────────────────────────────────

async function processSource(source, sb, cp) {
  const stream = fs.createReadStream(source.dump).pipe(createGunzip());
  const rl     = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNum       = 0;
  let sessionInserted = 0;
  let batch         = [];
  let lastCheckpoint = Date.now();

  const flush = async () => {
    if (!batch.length) return;
    if (!DRY_RUN) {
      const { error } = await sb
        .from('products')
        .upsert(batch, { onConflict: 'barcode', ignoreDuplicates: true });
      if (error) {
        // retry row-by-row to skip bad ones
        for (const row of batch) {
          const { error: e2 } = await sb
            .from('products')
            .upsert(row, { onConflict: 'barcode', ignoreDuplicates: true });
          if (!e2) sessionInserted++;
        }
      } else {
        sessionInserted += batch.length;
      }
    } else {
      sessionInserted += batch.length;
    }
    batch = [];
  };

  console.log(`\nProcessing ${source.name}...`);
  if (cp.linesProcessed > 0) {
    console.log(`  Skipping ${cp.linesProcessed.toLocaleString()} already-processed lines...`);
  }

  for await (const line of rl) {
    lineNum++;

    // Skip lines already processed in a previous run
    if (lineNum <= cp.linesProcessed) {
      if (lineNum % 500_000 === 0) {
        process.stdout.write(`\r  Skipping: ${lineNum.toLocaleString()} / ${cp.linesProcessed.toLocaleString()}   `);
      }
      continue;
    }

    if (!line.trim()) continue;

    let p;
    try { p = JSON.parse(line); }
    catch { continue; }

    // Must be tagged for India
    if (!p.countries_tags?.includes('en:india')) continue;

    const barcode = p.code?.toString().trim();
    const name    = (p.product_name || p.generic_name || '').trim();
    if (!barcode || !name) continue;

    const brand = (p.brands || p.brand_owner || 'Unknown').split(',')[0].trim().slice(0, 255);
    const ingredients = (p.ingredients_text || '')
      .split(/,\s*/).map(s => s.trim()).filter(Boolean).slice(0, 100);

    const n  = p.nutriments || {};
    const ni = {};
    const nutrientKeys = {
      'energy-kcal_100g': 'energy_kcal',
      'fat_100g':         'fat',
      'saturated-fat_100g': 'saturated_fat',
      'carbohydrates_100g': 'carbohydrates',
      'sugars_100g':      'sugars',
      'fiber_100g':       'fiber',
      'proteins_100g':    'proteins',
      'salt_100g':        'salt',
    };
    for (const [k, v] of Object.entries(nutrientKeys)) {
      if (n[k] != null) ni[v] = parseFloat(n[k]);
    }

    const rawGrade   = p.nutriscore_grade?.toUpperCase();
    const score_grade = ['A','B','C','D','E'].includes(rawGrade) ? rawGrade : null;

    batch.push({
      barcode,
      name:           name.slice(0, 255),
      brand,
      category:       mapCategory(p.categories_tags, name),
      image_url:      p.image_url || p.image_small_url || null,
      ingredients,
      nutritional_info: Object.keys(ni).length ? ni : {},
      score_grade,
      verified:       false,
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
  cp.linesProcessed = 0; // reset for next source
  cp.totalInserted  += sessionInserted;
  saveCheckpoint(cp);

  console.log(`\n  ${source.name} done: +${sessionInserted.toLocaleString()} products`);
  return sessionInserted;
}

// ─── Main with auto-retry ─────────────────────────────────────────────────────

async function run(cp) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  for (let i = cp.sourceIndex; i < SOURCES.length; i++) {
    const source = SOURCES[i];
    cp.sourceIndex = i;
    saveCheckpoint(cp);

    console.log(`\n━━━ [${i + 1}/${SOURCES.length}] ${source.name} ━━━`);

    // Download dump (resume if partial)
    await downloadFile(source.url, source.dump);

    // Process and upsert
    await processSource(source, sb, cp);

    // Advance to next source
    cp.sourceIndex    = i + 1;
    cp.linesProcessed = 0;
    saveCheckpoint(cp);
  }

  console.log(`\n✓ All sources complete. Total products inserted: ${cp.totalInserted.toLocaleString()}`);

  // Clean up checkpoint on full success
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
}

async function main() {
  console.log('═══ Sift Bulk Import ═══');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Resume: ${RESUME}`);
  console.log(`Supabase: ${SUPABASE_URL}`);

  const cp = loadCheckpoint();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await run(cp);
      break; // success
    } catch (err) {
      console.error(`\n✗ Error on attempt ${attempt}: ${err.message}`);
      console.error(`  Restarting in ${RETRY_DELAY / 1000}s... (Ctrl+C to stop)`);
      // Reload checkpoint — run() saves progress before crashing
      const saved = loadCheckpoint();
      Object.assign(cp, saved);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
  }
}

main();
