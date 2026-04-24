#!/usr/bin/env node
/**
 * scripts/fix-and-score.mjs
 *
 * Three-phase enrichment pipeline:
 *   Phase 1 — Fix wrong categories for all products (fast, keyword re-mapping)
 *   Phase 2 — Fetch missing ingredients from OFF API (rate-limited, checkpointed)
 *   Phase 3 — AI safety scoring via Gemini for all products with ingredients
 *
 * Usage:
 *   node scripts/fix-and-score.mjs              # run all phases
 *   node scripts/fix-and-score.mjs --resume     # resume from checkpoint
 *   node scripts/fix-and-score.mjs --phase 2    # run only a specific phase
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY       = process.env.GOOGLE_AI_API_KEY;
const CHECKPOINT_FILE  = path.join(__dirname, '.fix-score-checkpoint.json');

const ONLY_PHASE = process.argv.includes('--phase')
  ? parseInt(process.argv[process.argv.indexOf('--phase') + 1], 10)
  : null;
const RESUME = process.argv.includes('--resume');

// ─── Supabase ──────────────────────────────────────────────────────────────────

function makeClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
}

// ─── Checkpoint ────────────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (RESUME && fs.existsSync(CHECKPOINT_FILE)) {
    try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')); } catch {}
  }
  return { phase: 1, offset: 0, enriched: 0, scored: 0 };
}
function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ─── Category mapping (improved) ──────────────────────────────────────────────

function mapCategory(name = '', brand = '', categoryHint = '') {
  const hay = (name + ' ' + brand + ' ' + categoryHint).toLowerCase();
  if (/baby|infant|cerelac/.test(hay))                                              return 'baby_food';
  if (/mineral water|packaged water|drinking water/.test(hay))                     return 'water';
  if (/shampoo|conditioner|hair.?(oil|serum|mask|cream)|anti.?dandruff/.test(hay)) return 'haircare';
  if (/face.?wash|skin.?care|moisturis|sunscreen|serum|toner|face.?cream/.test(hay)) return 'skincare';
  if (/soap|hand.?wash|body.?wash|bathing.?bar|shower.?gel/.test(hay))             return 'household';
  if (/cosmetic|makeup|lipstick|mascara|foundation|kajal|kohl/.test(hay))          return 'cosmetic';
  if (/detergent|dishwash|household|laundry|cleaner|floor/.test(hay))              return 'household';
  if (/shave|after.?shave|deo|deodorant|perfume|cologne/.test(hay))               return 'cosmetic';
  if (/tea|coffee|juice|drink|soda|cola|lassi|shake|smoothie|squash|syrup|energy drink/.test(hay)) return 'beverage';
  if (/milk|curd|paneer|cheese|yogurt|butter|ghee|cream|dairy|dahi/.test(hay))    return 'dairy';
  if (/biscuit|cookie|chips|namkeen|snack|wafer|cracker|popcorn|bhujia|chakli/.test(hay)) return 'snack';
  if (/water/.test(hay))                                                           return 'water';
  return 'food';
}

// ─── Phase 1: Fix categories ───────────────────────────────────────────────────

async function phase1FixCategories(sb) {
  console.log('\n━━━ Phase 1: Fix Categories ━━━');

  const PAGE = 1000;
  let offset = 0;
  let fixed = 0;
  let total = 0;

  while (true) {
    const { data, error } = await sb
      .from('products')
      .select('id,name,brand,category')
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    if (!data?.length) break;

    const updates = [];
    for (const p of data) {
      const correct = mapCategory(p.name, p.brand);
      if (correct !== p.category) {
        updates.push({ id: p.id, category: correct });
      }
    }

    for (const u of updates) {
      await sb.from('products').update({ category: u.category }).eq('id', u.id);
      fixed++;
    }

    total += data.length;
    offset += PAGE;
    process.stdout.write(`\r  Checked ${total.toLocaleString()} | Fixed ${fixed.toLocaleString()} categories`);

    if (data.length < PAGE) break;
  }
  console.log(`\n  Done: fixed ${fixed} wrong categories out of ${total} products`);
}

// ─── Phase 2: Enrich missing ingredients from OFF API ─────────────────────────

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get(
      { hostname: u.hostname, path: u.pathname + u.search,
        headers: { 'User-Agent': 'SiftIndia/1.0 (ingredient enrichment; vansh@sift.in)' } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

async function fetchIngredientsFromOFF(barcode) {
  const data = await fetchJSON(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
  if (!data?.product) return null;
  const p = data.product;
  const text = p.ingredients_text || p.ingredients_text_en || '';
  if (!text.trim()) return null;
  return text.split(/,\s*/).map(s => s.trim()).filter(Boolean).slice(0, 100);
}

async function phase2EnrichIngredients(sb, cp) {
  console.log('\n━━━ Phase 2: Enrich Missing Ingredients ━━━');

  const PAGE = 200;
  let offset = cp.offset || 0;
  let enriched = cp.enriched || 0;
  let lastSave = Date.now();

  // Count total needing enrichment
  const { count: total } = await sb
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('ingredients', '{}');
  console.log(`  ${total.toLocaleString()} products need ingredient enrichment`);

  while (true) {
    const { data, error } = await sb
      .from('products')
      .select('id,barcode,name')
      .eq('ingredients', '{}')
      .range(0, PAGE - 1); // always fetch from top of missing list

    if (error) throw error;
    if (!data?.length) break;

    // Process in parallel batches of 5
    for (let i = 0; i < data.length; i += 5) {
      const batch = data.slice(i, i + 5);
      const results = await Promise.all(batch.map(async (p) => {
        const ingredients = await fetchIngredientsFromOFF(p.barcode);
        return { p, ingredients };
      }));

      for (const { p, ingredients } of results) {
        if (ingredients && ingredients.length > 0) {
          await sb.from('products').update({ ingredients }).eq('id', p.id);
          enriched++;
        } else {
          // Mark as checked so we don't keep re-fetching — set a placeholder
          // Actually skip — leave empty so we don't waste Gemini tokens
        }
      }

      // Small delay to respect OFF rate limits
      await new Promise(r => setTimeout(r, 300));

      offset += batch.length;
      process.stdout.write(
        `\r  Fetched ${offset.toLocaleString()} | Enriched ${enriched.toLocaleString()} | Remaining ~${Math.max(0, total - offset).toLocaleString()}`
      );

      if (Date.now() - lastSave > 30_000) {
        cp.offset = offset;
        cp.enriched = enriched;
        saveCheckpoint(cp);
        lastSave = Date.now();
      }
    }

    // If we got fewer than PAGE items, we've hit the end
    if (data.length < PAGE) break;
    // Give OFF API a breath
    await new Promise(r => setTimeout(r, 500));
  }

  cp.enriched = enriched;
  cp.offset = 0;
  saveCheckpoint(cp);
  console.log(`\n  Done: ${enriched} products enriched with ingredients`);
}

// ─── Phase 3: AI scoring via Gemini ───────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert food and cosmetic safety analyst for the Indian market (FSSAI regulations, WHO/ICMR guidelines).

Score Indian products on a 0-100 safety scale:
- 80-100 (A): Clean, minimal processing, no concerning additives
- 60-79 (B): Mostly safe, 1-2 minor concerns
- 40-59 (C): Multiple concerns, high sodium/sugar, synthetic additives
- 20-39 (D): Significant concerns — synthetic dyes, high trans fat
- 0-19 (E): Dangerous — banned/severely concerning substances

Key things to flag for Indian consumers:
- Azo dyes: tartrazine (INS 102), sunset yellow (INS 110), allura red (INS 129)
- Preservatives: sodium benzoate (INS 211) + vitamin C = benzene risk
- BHA (INS 320), BHT (INS 321) — possible endocrine disruptors
- Maida/refined flour — high GI, nutritionally poor (77M Indian diabetics)
- Palm oil — high saturated fat, cardiovascular risk
- MSG (INS 621), trans fats, TBHQ
- For cosmetics: parabens, SLS/SLES, formaldehyde releasers, phthalates

Respond ONLY with valid JSON matching the schema exactly.`;

async function scoreWithGemini(ingredients, category, name) {
  const prompt = `Product: "${name}" (category: ${category})
Ingredients: ${ingredients.join(', ')}

Analyze safety for Indian consumers. Return JSON:
{
  "score": <number 0-100>,
  "grade": <"A"|"B"|"C"|"D"|"E">,
  "summary": <"2-sentence plain English summary for Indian consumer">,
  "warnings": [<"specific warning strings">],
  "healthier_tip": <"one actionable India-specific tip">,
  "ingredient_risks": [{"name": <ingredient>, "risk_level": <"safe"|"caution"|"warning"|"danger">, "reason": <"brief">}]
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_KEY}`;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
  });

  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) { reject(new Error(json.error.message)); return; }
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
            // Extract JSON from response (may have markdown fences)
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) { reject(new Error('No JSON in response')); return; }
            const result = JSON.parse(match[0]);
            result.score = Math.max(0, Math.min(100, Math.round(result.score || 50)));
            result.grade = ['A','B','C','D','E'].includes(result.grade) ? result.grade
              : result.score >= 80 ? 'A' : result.score >= 60 ? 'B'
              : result.score >= 40 ? 'C' : result.score >= 20 ? 'D' : 'E';
            resolve(result);
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Gemini timeout')); });
    req.write(body);
    req.end();
  });
}

async function scoreOne(sb, product) {
  try {
    const analysis = await scoreWithGemini(product.ingredients, product.category, product.name);
    await sb.from('products').update({
      safety_score: analysis.score,
      score_grade:  analysis.grade,
      analysis: {
        summary:              analysis.summary,
        ingredients:          analysis.ingredient_risks ?? [],
        warnings:             analysis.warnings ?? [],
        healthier_alternative: analysis.healthier_alternative ?? analysis.healthier_tip ?? '',
      },
    }).eq('id', product.id);
    return true;
  } catch {
    return false;
  }
}

async function phase3ScoreProducts(sb, cp) {
  console.log('\n━━━ Phase 3: AI Safety Scoring (Gemini) ━━━');

  if (!GEMINI_KEY) {
    console.log('  No GOOGLE_AI_API_KEY — using keyword fallback');
    return phase3ScoreFallback(sb, cp);
  }

  const PAGE = 100;
  let scored = cp.scored || 0;
  let failed = 0;
  let lastSave = Date.now();

  const { count: total } = await sb
    .from('products')
    .select('*', { count: 'exact', head: true })
    .neq('ingredients', '{}')
    .is('safety_score', null);
  console.log(`  ${total?.toLocaleString()} products need scoring`);

  while (true) {
    const { data, error } = await sb
      .from('products')
      .select('id,name,brand,category,ingredients')
      .neq('ingredients', '{}')
      .is('safety_score', null)
      .limit(PAGE);

    if (error) throw error;
    if (!data?.length) break;

    // Process 3 at a time concurrently
    for (let i = 0; i < data.length; i += 3) {
      const batch = data.slice(i, i + 3);
      const results = await Promise.allSettled(batch.map(p => scoreOne(sb, p)));
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) scored++;
        else failed++;
      }

      // Respect Gemini rate limits
      await new Promise(r => setTimeout(r, 1000));

      process.stdout.write(
        `\r  Scored ${scored.toLocaleString()} | Failed ${failed} | Remaining ~${Math.max(0, (total || 0) - scored).toLocaleString()}`
      );

      if (Date.now() - lastSave > 30_000) {
        cp.scored = scored;
        saveCheckpoint(cp);
        lastSave = Date.now();
      }
    }
  }

  cp.scored = scored;
  saveCheckpoint(cp);
  console.log(`\n  Done: ${scored} products scored, ${failed} failed`);
}

// Keyword fallback scoring (no API needed)
function keywordScore(ingredients, category) {
  const danger = ['tartrazine','sunset yellow','msg','monosodium glutamate','sodium benzoate',
    'bha','bht','aspartame','allura red','titanium dioxide','tbhq','potassium bromate',
    'partially hydrogenated','trans fat','dmdm hydantoin','formaldehyde'];
  const caution = ['palm oil','refined flour','maida','sugar','corn syrup','artificial',
    'flavour','colour','preservative','emulsifier','sls','sodium lauryl','phosphate',
    'nitrate','modified starch','acidity regulator','maltodextrin'];

  const lower = ingredients.map(i => i.toLowerCase());
  let dangerCount = lower.filter(i => danger.some(k => i.includes(k))).length;
  let cautionCount = lower.filter(i => caution.some(k => i.includes(k))).length;
  const riskRatio = (dangerCount * 3 + cautionCount * 1.5) / Math.max(ingredients.length, 1);
  let score = Math.round(Math.max(5, Math.min(95, 85 - riskRatio * 25)));
  if (['snack','beverage'].includes(category)) score = Math.min(score, 65);
  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'E';
  const warnings = [];
  if (dangerCount > 0) warnings.push(`Contains ${dangerCount} ingredient(s) with known health concerns`);
  if (lower.some(i => i.includes('palm oil'))) warnings.push('Contains palm oil — high saturated fat');
  if (lower.some(i => i.includes('maida') || i.includes('refined flour'))) warnings.push('Contains maida — high glycemic index');
  return {
    score, grade,
    summary: score >= 75 ? 'Relatively safe with minimal concerning ingredients.'
      : score >= 50 ? 'Has some concerning ingredients. Consume in moderation.'
      : 'Contains multiple concerning ingredients. Consider healthier alternatives.',
    warnings,
    healthier_alternative: 'Look for products with whole grain ingredients and no artificial additives.',
    source: 'keyword_fallback',
  };
}

async function phase3ScoreFallback(sb, cp) {
  const PAGE = 500;
  let scored = cp.scored || 0;
  let lastSave = Date.now();

  while (true) {
    const { data, error } = await sb
      .from('products')
      .select('id,name,category,ingredients')
      .neq('ingredients', '{}')
      .is('safety_score', null)
      .limit(PAGE);

    if (error) throw error;
    if (!data?.length) break;

    for (const p of data) {
      const analysis = keywordScore(p.ingredients, p.category);
      await sb.from('products').update({
        safety_score: analysis.score,
        score_grade:  analysis.grade,
        analysis:     analysis,
      }).eq('id', p.id);
      scored++;

      if (Date.now() - lastSave > 10_000) {
        cp.scored = scored;
        saveCheckpoint(cp);
        lastSave = Date.now();
        process.stdout.write(`\r  Scored ${scored.toLocaleString()} products`);
      }
    }
  }

  cp.scored = scored;
  saveCheckpoint(cp);
  console.log(`\n  Done: ${scored} products keyword-scored`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function run(sb, cp) {
  const startPhase = ONLY_PHASE || cp.phase || 1;

  if (startPhase <= 1 && (!ONLY_PHASE || ONLY_PHASE === 1)) {
    await phase1FixCategories(sb);
    cp.phase = 2;
    saveCheckpoint(cp);
  }

  if (startPhase <= 2 && (!ONLY_PHASE || ONLY_PHASE === 2)) {
    await phase2EnrichIngredients(sb, cp);
    cp.phase = 3;
    cp.offset = 0;
    saveCheckpoint(cp);
  }

  if (startPhase <= 3 && (!ONLY_PHASE || ONLY_PHASE === 3)) {
    await phase3ScoreProducts(sb, cp);
    cp.phase = 4;
    saveCheckpoint(cp);
  }
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase env vars'); process.exit(1);
  }

  console.log('═══ Sift Fix & Score Pipeline ═══');
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Gemini:   ${GEMINI_KEY ? '✓ key found' : '✗ missing — will use keyword fallback'}`);

  const sb = makeClient();
  const MAX_RETRIES = 20;

  let cp = loadCheckpoint();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await run(sb, cp);
      console.log('\n✓ Pipeline complete!');
      if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
      break;
    } catch (err) {
      console.error(`\n✗ Error (attempt ${attempt}): ${err.message}`);
      cp = loadCheckpoint(); // reload latest checkpoint
      console.error(`  Restarting phase ${cp.phase} in 30s...`);
      await new Promise(r => setTimeout(r, 30_000));
    }
  }
}

main();
