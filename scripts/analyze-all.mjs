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
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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
    model: "gemini-2.5-flash",
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

async function main() {
  // Get all unanalyzed products with ingredients
  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .is("analysis", null)
    .not("ingredients", "eq", "{}")
    .order("scan_count", { ascending: false });

  if (error) {
    console.error("Failed to fetch products:", error.message);
    process.exit(1);
  }

  // Filter products that actually have ingredients
  const toAnalyze = products.filter(p => p.ingredients && p.ingredients.length > 0);
  console.log(`\n🔬 ${toAnalyze.length} products to analyze\n`);

  let done = 0;
  let failed = 0;
  const CONCURRENCY = 3;
  const startTime = Date.now();

  // Process in chunks of CONCURRENCY
  for (let i = 0; i < toAnalyze.length; i += CONCURRENCY) {
    const chunk = toAnalyze.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (product) => {
        try {
          const analysis = await analyzeProduct(product);

          const { error: updateErr } = await supabase
            .from("products")
            .update({
              safety_score: analysis.score,
              score_grade: analysis.grade,
              analysis,
              updated_at: new Date().toISOString(),
            })
            .eq("barcode", product.barcode);

          if (updateErr) throw new Error(updateErr.message);

          done++;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
          const rate = (done / (elapsed / 60)).toFixed(1);
          console.log(
            `✅ [${done}/${toAnalyze.length}] ${product.name.padEnd(35)} → ${analysis.score}/100 (${analysis.grade}) | ${elapsed}s | ${rate}/min`
          );
          return analysis;
        } catch (err) {
          failed++;
          console.error(`❌ [${done + failed}/${toAnalyze.length}] ${product.name}: ${err.message.slice(0, 80)}`);

          // If rate limited, wait and retry
          if (err.message.includes("429") || err.message.includes("quota")) {
            console.log("   ⏳ Rate limited, waiting 10s...");
            await new Promise(r => setTimeout(r, 10000));
          }
          throw err;
        }
      })
    );
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✨ Done! ${done} analyzed, ${failed} failed in ${totalTime} minutes\n`);
}

main().catch(console.error);
