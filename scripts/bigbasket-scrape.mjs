#!/usr/bin/env node
/**
 * Scrape BigBasket product pages using the full sitemap URL list.
 * Extracts ingredients, nutritional info, and all images from __NEXT_DATA__.
 *
 * Input:  data/bb-product-urls.txt  (205,514 URLs)
 * Output: data/bigbasket-products.jsonl
 *
 * Usage:
 *   node scripts/bigbasket-scrape.mjs
 *   node scripts/bigbasket-scrape.mjs --resume
 *   node scripts/bigbasket-scrape.mjs --concurrency=5
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URLS_FILE = path.join(__dirname, '../data/bb-product-urls.txt');
const OUT_FILE  = path.join(__dirname, '../data/bigbasket-products.jsonl');
const CP_FILE   = path.join(__dirname, '.bigbasket-checkpoint.json');

const RESUME      = process.argv.includes('--resume');
const CONCURRENCY = parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] ?? '4');
const DELAY_MS    = 500;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Referer': 'https://www.bigbasket.com/',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Fetch HTML and parse __NEXT_DATA__ ───────────────────────────────────────

async function fetchProduct(productUrl) {
  const resp = await fetch(productUrl, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No __NEXT_DATA__ found');
  return JSON.parse(m[1]);
}

// ─── Strip HTML ───────────────────────────────────────────────────────────────

function stripHtml(html) {
  return (html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/@import[^;]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Parse nutritional table from text ────────────────────────────────────────

function parseNutrition(text) {
  if (!text) return {};
  const nutrition = {};
  const patterns = [
    [/energy[^0-9]*([0-9.]+)\s*(kcal|kj)/i,       'energy_kcal'],
    [/protein[^0-9]*([0-9.]+)\s*g/i,               'protein_g'],
    [/carbohydrate[^0-9]*([0-9.]+)\s*g/i,          'carbohydrate_g'],
    [/total\s*sugars?[^0-9]*([0-9.<]+)\s*g/i,      'total_sugars_g'],
    [/added\s*sugars?[^0-9]*([0-9.<]+)\s*g/i,      'added_sugars_g'],
    [/total\s*fat[^0-9]*([0-9.<]+)\s*g/i,          'total_fat_g'],
    [/saturated\s*fat[^0-9]*([0-9.<]+)\s*g/i,      'saturated_fat_g'],
    [/trans\s*fat[^0-9]*([0-9.<]+)\s*g/i,          'trans_fat_g'],
    [/sodium[^0-9]*([0-9.<]+)\s*mg/i,              'sodium_mg'],
    [/dietary\s*fibre[^0-9]*([0-9.<]+)\s*g/i,      'fiber_g'],
  ];
  for (const [re, key] of patterns) {
    const m = text.match(re);
    if (m) {
      const val = parseFloat(m[1].replace('<', ''));
      if (!isNaN(val)) nutrition[key] = val;
    }
  }
  return nutrition;
}

// ─── Extract product from __NEXT_DATA__ response ──────────────────────────────

function extractProduct(data) {
  // HTML page wraps in props: data.props.pageProps (vs _next/data: data.pageProps)
  const pd = data?.props?.pageProps?.productDetails;
  const child = pd?.children?.[0];
  if (!child || !child.desc) return null;

  const getTab = (title) => stripHtml(child.tabs?.find(t => t.title === title)?.content || '');

  const ingText       = getTab('Ingredients');
  const nutritionText = getTab('Nutritional Facts');
  const infoText      = getTab('Other Product Info');

  // EAN from infoText — look for any numeric code labeled as EAN/barcode
  const eanMatch   = infoText.match(/EAN\s*(?:Code)?[:\s]*(\d{6,13})/i);
  const fssaiMatch = infoText.match(/\b(10\d{12})\b/);

  const nutrition = parseNutrition(nutritionText);

  const category = child.category?.tlc_slug || child.category?.tlc_name || '';

  return {
    name:             child.desc,
    brand:            child.brand?.name || '',
    category,
    sku:              String(child.id || ''),
    ean:              eanMatch?.[1] || '',
    fssai_license:    fssaiMatch?.[1] || '',
    ingredients_text: ingText,
    nutrition,
    nutritional_text: nutritionText,
    image_url:        child.images?.[0]?.l || child.images?.[0]?.m || '',
    all_images:       (child.images || []).map(i => i.xl || i.l || i.m || i.s).filter(Boolean),
    source:           'bigbasket',
  };
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (!fs.existsSync(CP_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CP_FILE, 'utf8')); } catch { return null; }
}
function saveCheckpoint(d) { fs.writeFileSync(CP_FILE, JSON.stringify(d, null, 2)); }

// ─── Read all URLs from file ──────────────────────────────────────────────────

async function readUrls() {
  const urls = [];
  const rl = readline.createInterface({ input: fs.createReadStream(URLS_FILE) });
  for await (const line of rl) { if (line.trim()) urls.push(line.trim()); }
  return urls;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('BigBasket sitemap scraper (HTML/__NEXT_DATA__ mode)');
  console.log(`Concurrency: ${CONCURRENCY} | Resume: ${RESUME}\n`);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  const cp      = RESUME ? loadCheckpoint() : null;
  let startIdx  = cp?.nextIdx  || 0;
  let saved     = cp?.saved    || 0;
  let skipped   = cp?.skipped  || 0;
  let failed    = cp?.failed   || 0;

  const allUrls = await readUrls();
  console.log(`Total URLs: ${allUrls.length} | Starting from: ${startIdx}\n`);

  const out = fs.createWriteStream(OUT_FILE, { flags: RESUME ? 'a' : 'w' });
  const startTime = Date.now();
  let lastCp = Date.now();
  let done = startIdx;

  for (let i = startIdx; i < allUrls.length; i += CONCURRENCY) {
    const batch = allUrls.slice(i, i + CONCURRENCY);

    await Promise.all(batch.map(async (url) => {
      try {
        const data = await fetchProduct(url);
        const product = extractProduct(data);
        if (product) {
          out.write(JSON.stringify(product) + '\n');
          saved++;
        } else {
          skipped++;
        }
      } catch (e) {
        failed++;
        if (process.env.DEBUG) console.error(`  fail: ${url} — ${e.message}`);
      }
      await sleep(DELAY_MS);
    }));

    done = i + batch.length;

    // Progress every 200 products
    if (Math.floor(i / CONCURRENCY) % 50 === 0) {
      const elapsed = (Date.now() - startTime) / 60000;
      const rate    = elapsed > 0 ? ((done - startIdx) / elapsed).toFixed(0) : '?';
      const pct     = ((done / allUrls.length) * 100).toFixed(1);
      const etaH    = done > startIdx && elapsed > 0
        ? (((allUrls.length - done) / ((done - startIdx) / elapsed)) / 60).toFixed(1)
        : '?';
      process.stdout.write(`[${done}/${allUrls.length} — ${pct}%] saved: ${saved} | skipped: ${skipped} | failed: ${failed} | ${rate}/min | ETA: ${etaH}h\n`);
    }

    // Checkpoint every 60s
    if (Date.now() - lastCp > 60_000) {
      saveCheckpoint({ nextIdx: done, saved, skipped, failed });
      lastCp = Date.now();
    }
  }

  out.end();
  saveCheckpoint({ nextIdx: done, saved, skipped, failed, done: true });
  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\nDone in ${elapsed} min | saved: ${saved} | skipped: ${skipped} | failed: ${failed}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
