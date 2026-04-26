#!/usr/bin/env node
/**
 * Use Gemini to infer ingredients + full safety analysis for products that
 * have no ingredient data (ingredients = '{}'). Writes both `ingredients`
 * and the full `analysis` / `safety_score` in one pass.
 *
 * Usage:
 *   node scripts/ai-infer-ingredients.mjs            # fresh start
 *   node scripts/ai-infer-ingredients.mjs --resume   # resume from checkpoint
 *   node scripts/ai-infer-ingredients.mjs --concurrency 5
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEMINI_KEY    = process.env.GOOGLE_AI_API_KEY;

const RESUME      = process.argv.includes("--resume");
const CONCURRENCY = parseInt(process.argv.find(a => a.startsWith("--concurrency="))?.split("=")[1] ?? "3");
const BATCH_SIZE  = 100;
const CHECKPOINT_FILE = resolve(__dirname, ".ai-infer-checkpoint.json");
const UUID_ZERO   = "00000000-0000-0000-0000-000000000000";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("Missing GOOGLE_AI_API_KEY");
  process.exit(1);
}

// ─── Clients ──────────────────────────────────────────────────────────────────

const sb    = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// ─── Gemini schema ────────────────────────────────────────────────────────────

const SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    ingredients_known: {
      type: SchemaType.BOOLEAN,
      description: "true if you have reasonable knowledge of this product's ingredients",
    },
    ingredients: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Flat list of ingredient names as they appear on the label",
    },
    score: { type: SchemaType.NUMBER },
    grade: { type: SchemaType.STRING, enum: ["A", "B", "C", "D", "E"] },
    summary: { type: SchemaType.STRING },
    ingredient_analysis: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name:        { type: SchemaType.STRING },
          risk_level:  { type: SchemaType.STRING, enum: ["safe", "caution", "warning", "danger"] },
          explanation: { type: SchemaType.STRING },
        },
        required: ["name", "risk_level", "explanation"],
      },
    },
    warnings:     { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    healthier_tip: { type: SchemaType.STRING },
  },
  required: ["ingredients_known", "ingredients", "score", "grade", "summary", "ingredient_analysis", "warnings", "healthier_tip"],
};

const SYSTEM_PROMPT = `You are an expert food and cosmetic safety analyst for the Indian market.

For each product:
1. Recall the real ingredients from your training knowledge of this product.
2. Score it 0-100:
   - 80-100 (A): Clean, minimal processing, no concerning additives
   - 60-79  (B): Mostly safe, 1-2 minor concerns
   - 40-59  (C): Multiple concerns, high sodium/sugar, synthetic additives
   - 20-39  (D): Significant concerns — synthetic dyes, high trans fat
   - 0-19   (E): Dangerous — banned substances or severely misleading claims
3. If you genuinely don't know this specific product's ingredients, set ingredients_known=false and return an empty ingredients array.

Apply FSSAI regulations, WHO/ICMR guidelines, and Indian dietary context.`;

function scoreToGrade(score) {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "E";
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8")); } catch { return null; }
}

function saveCheckpoint(data) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
}

// ─── Gemini call ──────────────────────────────────────────────────────────────

async function inferProduct(product) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
    },
  });

  const prompt = `Product: ${product.name}
Brand: ${product.brand ?? "unknown"}
Category: ${product.category ?? "Food"}
Barcode: ${product.barcode}

Provide the real ingredient list and safety analysis for this product sold in India.`;

  const response = await model.generateContent(prompt);
  const result = JSON.parse(response.response.text());
  result.score = Math.max(0, Math.min(100, Math.round(result.score)));
  result.grade = scoreToGrade(result.score);
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Sift — ai-infer-ingredients.mjs");
  console.log(`Resume: ${RESUME ? "ON" : "OFF"} | Concurrency: ${CONCURRENCY}`);

  const cp = RESUME ? loadCheckpoint() : null;
  let lastId   = cp?.lastId   ?? UUID_ZERO;
  let done     = cp?.done     ?? 0;
  let inferred = cp?.inferred ?? 0;
  let skipped  = cp?.skipped  ?? 0;
  let failed   = cp?.failed   ?? 0;

  // Count total
  const { count: total } = await sb
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("ingredients", "{}")
    .not("barcode", "is", null);

  console.log(`Total to process: ${total}\n`);

  const startTime = Date.now();
  let lastCheckpoint = Date.now();

  while (true) {
    const { data: rows, error } = await sb
      .from("products")
      .select("id, barcode, name, brand, category")
      .eq("ingredients", "{}")
      .not("barcode", "is", null)
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) { console.error("Supabase error:", error.message); break; }
    if (!rows || rows.length === 0) break;

    // Process CONCURRENCY products in parallel
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const chunk = rows.slice(i, i + CONCURRENCY);

      await Promise.all(chunk.map(async (product) => {
        try {
          const result = await inferProduct(product);

          if (!result.ingredients_known || result.ingredients.length === 0) {
            console.log(`  [unknown] ${product.barcode} — ${product.name}`);
            skipped++;
          } else {
            // Build the analysis object in the same shape as analyze-all.mjs
            const analysis = {
              score:        result.score,
              grade:        result.grade,
              summary:      result.summary,
              ingredients:  result.ingredient_analysis,
              warnings:     result.warnings,
              healthier_tip: result.healthier_tip,
              ai_inferred:  true,
            };

            const { error: updateErr } = await sb
              .from("products")
              .update({
                ingredients:  result.ingredients,
                safety_score: result.score,
                score_grade:  result.grade,
                analysis,
                updated_at:   new Date().toISOString(),
              })
              .eq("id", product.id);

            if (updateErr) {
              console.error(`  [update error] ${product.name}: ${updateErr.message}`);
              failed++;
            } else {
              inferred++;
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
              const rate    = (inferred / (elapsed / 60)).toFixed(1);
              console.log(`  ✅ [${done + 1}/${total}] ${product.name.padEnd(40)} → ${result.score}/100 (${result.grade}) | ${rate}/min`);
            }
          }
        } catch (err) {
          const msg = err.message ?? "";
          failed++;
          if (msg.includes("429") || msg.includes("quota")) {
            console.log(`  ⏳ Rate limited on "${product.name}" — waiting 15s`);
            await new Promise(r => setTimeout(r, 15_000));
          } else {
            console.error(`  ❌ ${product.name}: ${msg.slice(0, 80)}`);
          }
        }

        done++;
      }));

      // Advance cursor to last row of chunk
      lastId = chunk[chunk.length - 1].id;

      // Progress
      if (done % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const pct = ((done / total) * 100).toFixed(1);
        console.log(`\n[${done}/${total} — ${pct}%] inferred: ${inferred}, skipped: ${skipped}, failed: ${failed} | ${elapsed} min\n`);
      }

      // Checkpoint every 60s
      if (Date.now() - lastCheckpoint > 60_000) {
        saveCheckpoint({ lastId, done, inferred, skipped, failed, savedAt: new Date().toISOString() });
        lastCheckpoint = Date.now();
      }
    }
  }

  saveCheckpoint({ lastId, done, inferred, skipped, failed, savedAt: new Date().toISOString(), complete: true });

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Done in ${elapsed} min`);
  console.log(`  Inferred : ${inferred}`);
  console.log(`  Skipped  : ${skipped} (Gemini doesn't know them)`);
  console.log(`  Failed   : ${failed}`);
  console.log(`${"─".repeat(50)}\n`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
