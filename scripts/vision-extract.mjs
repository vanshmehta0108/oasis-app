#!/usr/bin/env node
/**
 * Extract ingredients + nutritional facts from BigBasket product label images
 * using Gemini Vision. Updates Supabase with label-accurate data.
 *
 * Usage:
 *   node scripts/vision-extract.mjs                  # process all unscored
 *   node scripts/vision-extract.mjs --resume
 *   node scripts/vision-extract.mjs --source bigbasket-products.jsonl
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEMINI_KEY   = process.env.GOOGLE_AI_API_KEY;
const RESUME       = process.argv.includes('--resume');
const CONCURRENCY  = 3;
const CP_FILE      = resolve(__dirname, '.vision-extract-checkpoint.json');
const UUID_ZERO    = '00000000-0000-0000-0000-000000000000';

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_KEY) {
  console.error('Missing env vars'); process.exit(1);
}

const sb    = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    found_label: {
      type: SchemaType.BOOLEAN,
      description: 'true if any image shows an ingredient list or nutrition panel',
    },
    ingredients: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Ingredients exactly as listed on the label, in order',
    },
    nutrition: {
      type: SchemaType.OBJECT,
      description: 'Nutritional values per 100g/100ml as shown on label',
      properties: {
        energy_kcal:     { type: SchemaType.NUMBER },
        protein_g:       { type: SchemaType.NUMBER },
        carbohydrate_g:  { type: SchemaType.NUMBER },
        total_sugars_g:  { type: SchemaType.NUMBER },
        added_sugars_g:  { type: SchemaType.NUMBER },
        total_fat_g:     { type: SchemaType.NUMBER },
        saturated_fat_g: { type: SchemaType.NUMBER },
        trans_fat_g:     { type: SchemaType.NUMBER },
        sodium_mg:       { type: SchemaType.NUMBER },
        fiber_g:         { type: SchemaType.NUMBER },
      },
    },
    fssai_license:   { type: SchemaType.STRING, description: '14-digit FSSAI license number if visible' },
    allergens:       { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    serving_size:    { type: SchemaType.STRING },
  },
  required: ['found_label', 'ingredients'],
};

// ─── Fetch image as base64 ────────────────────────────────────────────────────

async function fetchImageBase64(url) {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
  const buf = await resp.arrayBuffer();
  return {
    inlineData: {
      data: Buffer.from(buf).toString('base64'),
      mimeType: resp.headers.get('content-type') || 'image/jpeg',
    },
  };
}

// ─── Gemini vision call ───────────────────────────────────────────────────────

async function extractFromImages(imageUrls) {
  // Try up to 5 images — prioritise later ones (usually back/side of pack)
  const urls = imageUrls.slice(0, 5).reverse(); // reverse: last image first

  const imageParts = [];
  for (const url of urls) {
    try {
      imageParts.push(await fetchImageBase64(url));
    } catch { /* skip failed image */ }
  }

  if (imageParts.length === 0) return null;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
    },
  });

  const prompt = `These are product packaging images from an Indian food/personal care product.
Find the ingredient list and nutritional information table on the label.
Extract them accurately — spelling, order, and INS/E numbers exactly as printed.
If no label is visible, set found_label to false.`;

  const response = await model.generateContent([prompt, ...imageParts]);
  return JSON.parse(response.response.text());
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (!fs.existsSync(CP_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CP_FILE, 'utf8')); } catch { return null; }
}
function saveCheckpoint(d) { fs.writeFileSync(CP_FILE, JSON.stringify(d, null, 2)); }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Sift — vision-extract.mjs');
  console.log(`Resume: ${RESUME} | Concurrency: ${CONCURRENCY}\n`);

  const cp     = RESUME ? loadCheckpoint() : null;
  let lastId   = cp?.lastId   ?? UUID_ZERO;
  let done     = cp?.done     ?? 0;
  let enriched = cp?.enriched ?? 0;
  let noLabel  = cp?.noLabel  ?? 0;
  let failed   = cp?.failed   ?? 0;

  // Count target products: have images (via image_url or analysis.all_images) but no ingredients
  const { count: total } = await sb
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('ingredients', '{}')
    .not('image_url', 'is', null)
    .neq('image_url', '');

  console.log(`Products with images but no ingredients: ${total ?? 'unknown'}\n`);

  const startTime = Date.now();
  let lastCp = Date.now();

  while (true) {
    const { data: rows, error } = await sb
      .from('products')
      .select('id, name, brand, image_url, analysis')
      .eq('ingredients', '{}')
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(30);

    if (error) { console.error('Supabase error:', error.message); break; }
    if (!rows || rows.length === 0) break;

    // Process in parallel chunks
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY);

      await Promise.all(chunk.map(async (product) => {
        // all_images stored in analysis.all_images by bb-import.mjs; fall back to image_url
        const images = product.analysis?.all_images?.length
          ? product.analysis.all_images
          : (product.image_url ? [product.image_url] : []);
        if (images.length === 0) { done++; noLabel++; return; }

        try {
          const result = await extractFromImages(images);

          if (!result?.found_label || !result.ingredients?.length) {
            noLabel++;
          } else {
            // Build update payload
            const update = {
              ingredients: result.ingredients,
              updated_at:  new Date().toISOString(),
            };
            if (result.nutrition && Object.keys(result.nutrition).length > 0) {
              update.nutritional_info = result.nutrition;
            }
            if (result.fssai_license) update.fssai_license = result.fssai_license;
            // store allergens + serving_size inside analysis
            if (result.allergens?.length || result.serving_size) {
              const existingAnalysis = product.analysis || {};
              update.analysis = {
                ...existingAnalysis,
                allergens: result.allergens || [],
                serving_size: result.serving_size || '',
                vision_extracted: true,
              };
            }

            const { error: updateErr } = await sb
              .from('products')
              .update(update)
              .eq('id', product.id);

            if (updateErr) {
              console.error(`  [err] ${product.name}: ${updateErr.message}`);
              failed++;
            } else {
              enriched++;
              const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
              const rate    = (enriched / parseFloat(elapsed)).toFixed(1);
              console.log(`  ✅ ${product.name?.slice(0,45).padEnd(45)} ${result.ingredients.length} ing | ${rate}/min`);
            }
          }
        } catch (e) {
          failed++;
          if (e.message?.includes('429') || e.message?.includes('quota')) {
            console.log(`  ⏳ Rate limited — waiting 20s`);
            await new Promise(r => setTimeout(r, 20_000));
          } else {
            console.error(`  ❌ ${product.name?.slice(0,40)}: ${e.message?.slice(0,60)}`);
          }
        }

        done++;
      }));

      lastId = chunk[chunk.length - 1].id;

      if (done % 30 === 0) {
        const pct = total ? (done / total * 100).toFixed(1) : '?';
        console.log(`\n[${done}/${total} — ${pct}%] enriched: ${enriched} | no label: ${noLabel} | failed: ${failed}\n`);
      }

      if (Date.now() - lastCp > 60_000) {
        saveCheckpoint({ lastId, done, enriched, noLabel, failed });
        lastCp = Date.now();
      }
    }
  }

  saveCheckpoint({ lastId, done, enriched, noLabel, failed, complete: true });
  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Done in ${elapsed} min | enriched: ${enriched} | no label: ${noLabel} | failed: ${failed}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
