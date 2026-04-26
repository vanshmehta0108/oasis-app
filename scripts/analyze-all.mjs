#!/usr/bin/env node
/**
 * Bulk analyze all unanalyzed products in Supabase using Gemini.
 * Run: node scripts/analyze-all.mjs
 *
 * Processes products sequentially with 3 concurrent requests.
 * ~24s per product × 3 concurrent = ~8s effective per product.
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

const SYSTEM_PROMPT = `You are an expert food and cosmetic safety analyst for the Indian market.

SCORING (0-100):
- 80-100 (A): Clean, minimal processing, no concerning additives
- 60-79 (B): Mostly safe, 1-2 minor concerns
- 40-59 (C): Multiple concerns, high sodium/sugar, synthetic additives
- 20-39 (D): Significant concerns — synthetic dyes, high trans fat, misleading labels
- 0-19 (E): Dangerous — banned substances, severely misleading claims

Consider FSSAI regulations, WHO/ICMR guidelines, and Indian dietary context (77M diabetics, 60-70% lactose intolerant, high heart disease rates). Be specific with INS numbers and limits.`;

const SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.NUMBER },
    grade: { type: SchemaType.STRING, enum: ["A", "B", "C", "D", "E"] },
    summary: { type: SchemaType.STRING },
    ingredients: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          risk_level: { type: SchemaType.STRING, enum: ["safe", "caution", "warning", "danger"] },
          explanation: { type: SchemaType.STRING },
        },
        required: ["name", "risk_level", "explanation"],
      },
    },
    warnings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    healthier_tip: { type: SchemaType.STRING },
  },
  required: ["score", "grade", "summary", "ingredients", "warnings", "healthier_tip"],
};

function scoreToGrade(score) {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "E";
}

async function analyzeProduct(product) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA,
    },
  });

  const prompt = `Analyze the safety of this ${product.category} product sold in India.\n\nIngredients: ${product.ingredients.join(", ")}\n\nFor each ingredient, identify INS numbers, FSSAI limits, and Indian health context.`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  const result = JSON.parse(text);
  result.score = Math.max(0, Math.min(100, Math.round(result.score)));
  result.grade = scoreToGrade(result.score);
  return result;
}

const UUID_ZERO = "00000000-0000-0000-0000-000000000000";
const BATCH_SIZE = 200;
const CONCURRENCY_ARG = process.argv.find(a => a.startsWith('--concurrency='));
const CONCURRENCY_OVERRIDE = CONCURRENCY_ARG ? parseInt(CONCURRENCY_ARG.split('=')[1]) : null;

async function main() {
  const { count: total } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .is("safety_score", null)
    .not("ingredients", "eq", "{}");

  console.log(`\n🔬 ${total ?? "?"} products to analyze\n`);

  let done = 0;
  let failed = 0;
  let lastId = UUID_ZERO;
  const CONCURRENCY = CONCURRENCY_OVERRIDE ?? 3;
  const startTime = Date.now();

  while (true) {
    const { data: products, error } = await supabase
      .from("products")
      .select("id, barcode, name, brand, category, ingredients, analysis")
      .is("safety_score", null)
      .not("ingredients", "eq", "{}")
      .gt("id", lastId)
      .order("id", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) { console.error("Fetch error:", error.message); break; }
    if (!products || products.length === 0) break;

    const toAnalyze = products.filter(p => p.ingredients?.length > 0);

    for (let i = 0; i < toAnalyze.length; i += CONCURRENCY) {
      const chunk = toAnalyze.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        chunk.map(async (product) => {
          try {
            const analysis = await analyzeProduct(product);

            // Preserve existing analysis fields (e.g. bb_sku, all_images from import)
            const mergedAnalysis = { ...(product.analysis || {}), ...analysis };

            const { error: updateErr } = await supabase
              .from("products")
              .update({
                safety_score: analysis.score,
                score_grade: analysis.grade,
                analysis: mergedAnalysis,
                updated_at: new Date().toISOString(),
              })
              .eq("id", product.id);

            if (updateErr) throw new Error(updateErr.message);

            done++;
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            const rate = (done / (elapsed / 60)).toFixed(1);
            console.log(
              `✅ [${done}/${total}] ${product.name.slice(0, 35).padEnd(35)} → ${analysis.score}/100 (${analysis.grade}) | ${rate}/min`
            );
          } catch (err) {
            failed++;
            console.error(`❌ ${product.name?.slice(0, 40)}: ${err.message?.slice(0, 80)}`);
            if (err.message?.includes("429") || err.message?.includes("quota")) {
              console.log("   ⏳ Rate limited, waiting 15s...");
              await new Promise(r => setTimeout(r, 15_000));
            }
          }
        })
      );
    }

    lastId = products[products.length - 1].id;
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✨ Pass done! ${done} analyzed, ${failed} failed in ${totalTime} min\n`);
}


// Run continuously — re-check every 2 min for newly imported products
async function loop() {
  while (true) {
    await main();
    console.log("⏳ Waiting 2 min before next pass...\n");
    await new Promise(r => setTimeout(r, 2 * 60_000));
  }
}

loop().catch(console.error);
