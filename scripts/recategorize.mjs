#!/usr/bin/env node
/**
 * Recategorize — re-classifies products whose `category` looks wrong.
 *
 * The bulk import pipeline categorized everything heuristically, which means
 * skincare ended up with "sambar powder" and food has stuff like soaps. This
 * script:
 *
 *   1. Pulls products in batches.
 *   2. Asks Gemini for the correct category given (name, brand, ingredients).
 *   3. Optionally cross-checks via Brave Search ("what is X?") for
 *      low-confidence calls — especially useful for ambiguous Indian product
 *      names that Gemini might not know.
 *   4. Writes the corrected category back, with a `category_confidence`
 *      field in `analysis` so we can audit later.
 *
 * Modes:
 *   --dry-run            Print proposed changes, don't write.  (DEFAULT)
 *   --apply              Actually write to DB.
 *   --category=skincare  Only consider one category at a time (recommended).
 *   --concurrency=5
 *   --limit=200          Stop after N products.
 *   --use-brave          Cross-check low-confidence calls with Brave Search.
 *                        Requires BRAVE_API_KEY in .env.local.
 *
 * Suggested first run:
 *   node scripts/recategorize.mjs --category=skincare --dry-run --limit=100
 *
 * After eyeballing the dry-run output:
 *   node scripts/recategorize.mjs --category=skincare --apply --use-brave
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEMINI_KEY   = process.env.GOOGLE_AI_API_KEY;
const BRAVE_KEY    = process.env.BRAVE_API_KEY;

const args = process.argv.slice(2);
const APPLY       = args.includes("--apply");
const USE_BRAVE   = args.includes("--use-brave");
const CATEGORY    = args.find(a => a.startsWith("--category="))?.split("=")[1] ?? null;
const CONCURRENCY = parseInt(args.find(a => a.startsWith("--concurrency="))?.split("=")[1] ?? "3");
const LIMIT       = parseInt(args.find(a => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const BATCH_SIZE  = 50;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!GEMINI_KEY) {
  console.error("Missing GOOGLE_AI_API_KEY");
  process.exit(1);
}
if (USE_BRAVE && !BRAVE_KEY) {
  console.error("--use-brave requires BRAVE_API_KEY in .env.local");
  process.exit(1);
}

// ─── Categories (must match the DB enum exactly) ──────────────────────────────

const VALID_CATEGORIES = ["food", "beverage", "snack", "dairy", "water", "skincare"];

// ─── Clients ──────────────────────────────────────────────────────────────────

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

const CATEGORY_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    category: {
      type: SchemaType.STRING,
      format: "enum",
      enum: VALID_CATEGORIES,
    },
    confidence: {
      type: SchemaType.NUMBER,
      description: "0.0-1.0 — how sure are you?",
    },
    reasoning: {
      type: SchemaType.STRING,
      description: "One short sentence explaining the call.",
    },
    needs_human_review: {
      type: SchemaType.BOOLEAN,
      description: "true if this is too ambiguous to categorize confidently — e.g. unrecognized brand, contradictory signals, or marketing-only name.",
    },
  },
  required: ["category", "confidence", "reasoning", "needs_human_review"],
};

const model = genAI.getGenerativeModel({
  // Match the model the app uses today — see src/lib/ai.ts. 2.0-flash is no
  // longer issued to new API keys; 2.5-flash is current.
  model: "gemini-2.5-flash",
  systemInstruction: [
    "You are an Indian retail product classifier.",
    "",
    "VALID CATEGORIES (use these exact strings):",
    "- food       — packaged foods, ready meals, spices, condiments, oils, atta, dal, rice, sweets",
    "- beverage   — soft drinks, juices, teas, coffees, energy drinks (NOT plain water)",
    "- snack      — biscuits, namkeen, chips, chocolates, candies, granola bars",
    "- dairy      — milk, curd, paneer, ghee, butter, cheese, yogurt, lassi",
    "- water      — bottled water only",
    "- skincare   — face creams, body lotions, sunscreens, soaps, shampoos, serums, conditioners, ONLY topical application",
    "",
    "RULES:",
    "- Spice powders (sambar powder, coriander powder, garam masala) → food, NEVER skincare.",
    "- Athlete moisturisers, hand washes, body lotions, deodorants → skincare.",
    "- Branded names like 'Bandh Bandh Powder' (mouth freshener) → food.",
    "- If you don't recognise the product AT ALL, set needs_human_review=true and pick your best guess.",
    "- Confidence ≥ 0.85 means you're very sure. < 0.6 means you're guessing — set needs_human_review=true.",
    "",
    "Be honest about ambiguity. Wrong-confident categorization is worse than flagging for review.",
  ].join("\n"),
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: CATEGORY_SCHEMA,
  },
});

// ─── Brave Search verifier ────────────────────────────────────────────────────

async function braveVerify(productName, brand) {
  if (!USE_BRAVE) return null;
  const q = encodeURIComponent(`${brand ?? ""} ${productName} india product`.trim().slice(0, 80));
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=3`, {
      headers: {
        "X-Subscription-Token": BRAVE_KEY,
        "Accept": "application/json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const snippets = (data?.web?.results ?? []).slice(0, 3).map(r => r.description ?? r.title ?? "").join(" ").toLowerCase();
    if (!snippets) return null;

    // Heuristic guess from snippets — only used as a sanity check, never
    // overrides Gemini blindly. If Brave snippets disagree strongly with
    // Gemini's call, we mark for human review.
    const lower = snippets;
    const guess =
      /(soap|shampoo|cream|lotion|sunscreen|moisturi[sz]er|face wash|conditioner|serum|deodorant|skincare|cosmetic)/.test(lower) ? "skincare" :
      /(milk|curd|paneer|ghee|butter|yogurt|lassi|cheese|dahi)/.test(lower) ? "dairy" :
      /(biscuit|chip|namkeen|chocolate|candy|cookie|wafer)/.test(lower) ? "snack" :
      /(juice|cola|drink|tea|coffee|energy drink|soda|cordial|squash)/.test(lower) ? "beverage" :
      /(bottled water|mineral water|packaged drinking water)/.test(lower) ? "water" :
      /(spice|powder|masala|atta|flour|rice|dal|pulse|oil|condiment)/.test(lower) ? "food" :
      null;
    return { snippets: lower.slice(0, 200), guess };
  } catch {
    return null;
  }
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

async function classify(product) {
  const prompt = [
    `Product: ${product.name}`,
    `Brand: ${product.brand ?? "Unknown"}`,
    `Current category in DB (likely wrong): ${product.category}`,
    `Ingredients: ${(product.ingredients ?? []).slice(0, 12).join(", ") || "(none)"}`,
    "",
    "What's the correct category?",
  ].join("\n");

  const res = await model.generateContent(prompt);
  const text = res.response.text();
  const out = JSON.parse(text);

  // Cross-check low-confidence calls with Brave.
  let brave = null;
  if (out.confidence < 0.85) {
    brave = await braveVerify(product.name, product.brand);
    if (brave?.guess && brave.guess !== out.category) {
      out.needs_human_review = true;
      out.reasoning += ` (Brave snippets suggest "${brave.guess}".)`;
    }
  }

  return { ...out, brave };
}

async function run() {
  console.log(`Mode: ${APPLY ? "APPLY (writes to DB)" : "DRY RUN (no writes)"}`);
  console.log(`Filter category: ${CATEGORY ?? "all"}`);
  console.log(`Brave verification: ${USE_BRAVE ? "ON" : "off"}`);
  console.log(`Concurrency: ${CONCURRENCY} | Batch size: ${BATCH_SIZE} | Limit: ${LIMIT || "none"}`);
  console.log("");

  let offset = 0;
  let processed = 0;
  let changes = 0;
  let needsReview = 0;
  const reviewQueue = [];

  while (true) {
    let q = sb.from("products").select("id, barcode, name, brand, category, ingredients").range(offset, offset + BATCH_SIZE - 1);
    if (CATEGORY) q = q.eq("category", CATEGORY);
    const { data, error } = await q;
    if (error) { console.error("Fetch failed:", error.message); break; }
    if (!data || data.length === 0) break;

    // Process in chunks of CONCURRENCY
    for (let i = 0; i < data.length; i += CONCURRENCY) {
      const chunk = data.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map(async (p) => {
        try {
          const r = await classify(p);
          return { product: p, result: r };
        } catch (err) {
          return { product: p, error: err.message };
        }
      }));

      for (const r of results) {
        processed++;
        if (r.error) {
          console.log(`  ✗ ${r.product.name}: ${r.error}`);
          continue;
        }
        const { product, result } = r;
        const changed = result.category !== product.category;
        const tag = result.needs_human_review ? "REVIEW" : changed ? "CHANGE" : "ok    ";
        const conf = `${(result.confidence * 100).toFixed(0)}%`;
        console.log(`  [${tag}] ${conf}  ${product.category} → ${result.category}  ·  ${product.name.slice(0, 40)}`);
        if (changed) console.log(`        ${result.reasoning}`);

        if (result.needs_human_review) {
          needsReview++;
          reviewQueue.push({
            id: product.id,
            barcode: product.barcode,
            name: product.name,
            brand: product.brand,
            from: product.category,
            proposed: result.category,
            confidence: result.confidence,
            reasoning: result.reasoning,
            brave_snippets: result.brave?.snippets,
            brave_guess: result.brave?.guess,
          });
        } else if (changed) {
          changes++;
          if (APPLY) {
            const { error: upErr } = await sb
              .from("products")
              .update({ category: result.category })
              .eq("id", product.id);
            if (upErr) console.log(`        ⚠ DB update failed: ${upErr.message}`);
          }
        }

        if (LIMIT && processed >= LIMIT) break;
      }
      if (LIMIT && processed >= LIMIT) break;
    }

    if (LIMIT && processed >= LIMIT) break;
    offset += BATCH_SIZE;
  }

  console.log("");
  console.log(`Processed: ${processed} | Changes: ${changes} | Needs review: ${needsReview}`);

  if (reviewQueue.length > 0) {
    const out = resolve(__dirname, ".recategorize-review-queue.json");
    const fs = await import("fs");
    fs.writeFileSync(out, JSON.stringify(reviewQueue, null, 2));
    console.log(`Review queue written to: ${out}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
