#!/usr/bin/env -S npx tsx
/**
 * QC harness for the deterministic personalization matcher.
 *
 * Runs a golden-set of (profile, ingredients, expected_rule_ids) cases and
 * asserts both precision (no false positives) and recall (no false negatives).
 * Also exercises normalization, penalty math, and profile dedup.
 *
 *   npx tsx scripts/qc-personalization.ts                # full run
 *   npx tsx scripts/qc-personalization.ts --case peanuts # filter
 *
 * Exit code 0 on success, 1 on any failure. CI / pre-deploy should run this.
 */

import {
  matchUserProfile,
  personalizationPenalty,
  applyPenalty,
  dedupeProfile,
  normalize,
  profileHash,
  __INTERNAL,
  type MatchResult,
} from "../src/lib/allergens";
import { getPersonalizedAnalysis } from "../src/lib/scoring";
import { personalizedScore } from "../src/lib/verdict";

// ── Test types ─────────────────────────────────────────────────────────────

interface GoldenCase {
  name: string;
  ingredients: string[];
  conditions?: string[];
  allergies?: string[];
  // Rule IDs that must fire (recall).
  mustMatch: string[];
  // Rule IDs that must NOT fire (precision).
  mustNotMatch?: string[];
  // Optional severity expectation per rule_id.
  severityFor?: Record<string, "info" | "moderate" | "serious">;
  // Optional minimum penalty.
  minPenalty?: number;
}

const GOLDEN: GoldenCase[] = [
  // ── Allergies ─────────────────────────────────────────────────────────
  {
    name: "peanut allergy → groundnut oil flagged",
    ingredients: ["Refined Groundnut Oil", "Salt", "Spices"],
    allergies: ["Peanuts"],
    mustMatch: ["allergy.peanuts"],
    severityFor: { "allergy.peanuts": "serious" },
    minPenalty: 30,
  },
  {
    name: "peanut allergy → moongfali (Hindi) flagged",
    ingredients: ["Moongfali", "Sugar", "Salt"],
    allergies: ["Peanut"],
    mustMatch: ["allergy.peanuts"],
  },
  {
    name: "peanut allergy → bare 'almond' should NOT trigger peanut",
    ingredients: ["Almond Powder", "Sugar"],
    allergies: ["Peanuts"],
    mustMatch: [],
    mustNotMatch: ["allergy.peanuts"],
  },
  {
    name: "tree-nut allergy → kaju (Hindi cashew) flagged",
    ingredients: ["Kaju", "Sugar", "Milk Solids"],
    allergies: ["Tree Nuts"],
    mustMatch: ["allergy.tree_nuts"],
  },
  {
    name: "milk allergy → 'milk solids' flagged",
    ingredients: ["Wheat Flour", "Milk Solids", "Sugar"],
    allergies: ["Milk"],
    mustMatch: ["allergy.milk"],
    severityFor: { "allergy.milk": "serious" },
  },
  {
    name: "milk allergy → 'almond milk' should NOT trigger dairy",
    ingredients: ["Almond Milk", "Sugar", "Vanilla"],
    allergies: ["Milk"],
    mustNotMatch: ["allergy.milk"],
    mustMatch: [],
  },
  {
    name: "milk allergy → 'peanut butter' should NOT trigger dairy butter rule",
    ingredients: ["Peanut Butter", "Salt"],
    allergies: ["Milk"],
    mustNotMatch: ["allergy.milk"],
    mustMatch: [],
  },
  {
    name: "milk allergy → 'butter' alone IS flagged",
    ingredients: ["Wheat Flour", "Butter", "Sugar"],
    allergies: ["Milk"],
    mustMatch: ["allergy.milk"],
  },
  {
    name: "milk allergy → 'whey protein' flagged",
    ingredients: ["Whey Protein Concentrate", "Soy Lecithin", "Cocoa"],
    allergies: ["Milk"],
    mustMatch: ["allergy.milk"],
  },
  {
    name: "milk allergy → 'lactose' flagged",
    ingredients: ["Sugar", "Lactose", "Cocoa"],
    allergies: ["Dairy"],
    mustMatch: ["allergy.milk"],
  },
  {
    name: "soy allergy → 'soy lecithin' flagged",
    ingredients: ["Cocoa", "Sugar", "Soy Lecithin (INS 322)"],
    allergies: ["Soy"],
    mustMatch: ["allergy.soy"],
  },
  {
    name: "egg allergy → 'albumen' flagged",
    ingredients: ["Wheat Flour", "Sugar", "Albumen", "Salt"],
    allergies: ["Eggs"],
    mustMatch: ["allergy.eggs"],
    severityFor: { "allergy.eggs": "serious" },
  },
  {
    name: "gluten allergy → maida flagged",
    ingredients: ["Maida", "Sugar", "Edible Vegetable Oil"],
    allergies: ["Gluten"],
    mustMatch: ["allergy.gluten"],
  },
  {
    name: "gluten allergy → barley malt extract flagged",
    ingredients: ["Rice", "Sugar", "Malt Extract", "Salt"],
    allergies: ["Gluten"],
    mustMatch: ["allergy.gluten"],
  },
  {
    name: "shellfish allergy → prawns flagged",
    ingredients: ["Prawns", "Salt", "Spices"],
    allergies: ["Shellfish"],
    mustMatch: ["allergy.shellfish"],
  },
  {
    name: "fish allergy → anchovy flagged",
    ingredients: ["Sunflower Oil", "Anchovy Paste", "Salt"],
    allergies: ["Fish"],
    mustMatch: ["allergy.fish"],
  },
  {
    name: "sulfite allergy → INS 220 flagged",
    ingredients: ["Sugar", "Citric Acid", "Sulfur Dioxide (INS 220)"],
    allergies: ["Sulfites"],
    mustMatch: ["allergy.sulfites"],
  },
  {
    name: "sesame allergy → 'til' (Hindi) flagged",
    ingredients: ["Wheat Flour", "Til", "Salt"],
    allergies: ["Sesame"],
    mustMatch: ["allergy.sesame"],
  },
  {
    name: "tartrazine sensitivity → INS 102 flagged",
    ingredients: ["Sugar", "Color (INS 102)", "Citric Acid"],
    allergies: ["Tartrazine"],
    mustMatch: ["allergy.tartrazine"],
  },

  // ── Conditions ────────────────────────────────────────────────────────
  {
    name: "diabetic → sugar + maida = 2 distinct rule fires",
    ingredients: ["Maida", "Sugar", "Refined Palm Oil", "Salt"],
    conditions: ["Diabetic"],
    mustMatch: ["condition.diabetic.added_sugar", "condition.diabetic.refined_carbs"],
    minPenalty: 30,
  },
  {
    name: "diabetic → jaggery flagged as added sugar",
    ingredients: ["Wheat Flour", "Jaggery", "Cardamom"],
    conditions: ["Diabetes Type 2"],
    mustMatch: ["condition.diabetic.added_sugar"],
  },
  {
    name: "diabetic → 'fruit juice concentrate' flagged",
    ingredients: ["Water", "Fruit Juice Concentrate", "Pectin"],
    conditions: ["Diabetic"],
    mustMatch: ["condition.diabetic.added_sugar"],
  },
  {
    name: "high BP → MSG (INS 621) flagged",
    ingredients: ["Wheat Flour", "Salt", "Flavour Enhancer (INS 621)"],
    conditions: ["High BP"],
    mustMatch: ["condition.hypertension.sodium"],
  },
  {
    name: "high BP → sodium nitrite flagged",
    ingredients: ["Pork", "Salt", "Sodium Nitrite", "Spices"],
    conditions: ["Hypertension"],
    mustMatch: ["condition.hypertension.sodium"],
  },
  {
    name: "heart → vanaspati = serious trans-fat hit",
    ingredients: ["Wheat Flour", "Vanaspati", "Sugar"],
    conditions: ["Heart Condition"],
    mustMatch: ["condition.heart.trans_fats"],
    severityFor: { "condition.heart.trans_fats": "serious" },
    minPenalty: 30,
  },
  {
    name: "heart → palm oil flagged moderate",
    ingredients: ["Wheat Flour", "Refined Palm Oil", "Sugar"],
    conditions: ["Heart Condition"],
    mustMatch: ["condition.heart.palm_oil"],
    severityFor: { "condition.heart.palm_oil": "moderate" },
  },
  {
    name: "lactose intolerant → 'condensed milk' flagged",
    ingredients: ["Sweetened Condensed Milk", "Sugar", "Cocoa"],
    conditions: ["Lactose Intolerant"],
    mustMatch: ["condition.lactose.dairy"],
  },
  {
    name: "lactose intolerant → ghee flagged 'info' only",
    ingredients: ["Wheat Flour", "Ghee", "Sugar"],
    conditions: ["Lactose Intolerant"],
    mustMatch: ["condition.lactose.dairy_fat"],
    severityFor: { "condition.lactose.dairy_fat": "info" },
  },
  {
    name: "celiac → wheat starch flagged",
    ingredients: ["Wheat Starch", "Sugar", "Salt"],
    conditions: ["Celiac"],
    mustMatch: ["condition.gluten.wheat"],
  },
  {
    name: "thyroid → soy lecithin flagged",
    ingredients: ["Cocoa", "Sugar", "Soy Lecithin"],
    conditions: ["Thyroid"],
    mustMatch: ["condition.thyroid.soy"],
  },
  {
    name: "kidney disease → phosphoric acid (INS 338) flagged serious",
    ingredients: ["Carbonated Water", "Sugar", "Phosphoric Acid", "Caffeine"],
    conditions: ["Kidney Disease"],
    mustMatch: ["condition.kidney.phosphates"],
    severityFor: { "condition.kidney.phosphates": "serious" },
  },
  {
    name: "PKU → aspartame flagged serious",
    ingredients: ["Sweetener (INS 951)", "Citric Acid", "Flavour"],
    conditions: ["PKU"],
    mustMatch: ["condition.pku.aspartame"],
    severityFor: { "condition.pku.aspartame": "serious" },
  },
  {
    name: "pregnant → caffeine info-flagged",
    ingredients: ["Water", "Sugar", "Caffeine", "Phosphoric Acid"],
    conditions: ["Pregnant"],
    mustMatch: ["condition.pregnant.caffeine"],
    severityFor: { "condition.pregnant.caffeine": "info" },
  },
  {
    name: "PCOS → maida flagged",
    ingredients: ["Maida", "Sugar", "Vegetable Oil"],
    conditions: ["PCOS"],
    mustMatch: ["condition.pcod.sugar"],
  },

  // ── Negative cases (precision) ────────────────────────────────────────
  {
    name: "clean product, full profile → zero matches",
    ingredients: ["Brown Rice", "Quinoa", "Pumpkin Seeds", "Sea Salt"],
    conditions: ["Diabetic", "Heart Condition", "Lactose Intolerant"],
    allergies: ["Peanuts", "Tree Nuts", "Soy"],
    mustMatch: [],
    minPenalty: 0,
  },
  {
    name: "no profile → zero matches even on dirty product",
    ingredients: ["Maida", "Sugar", "Palm Oil", "Vanaspati", "MSG"],
    mustMatch: [],
    minPenalty: 0,
  },
  {
    name: "diabetic + clean keto product → zero matches",
    ingredients: ["Almond Flour", "Coconut Oil", "Eggs", "Salt"],
    conditions: ["Diabetic"],
    mustMatch: [],
  },

  // ── Multi-rule combination ───────────────────────────────────────────
  {
    name: "diabetic + heart + lactose intolerant on chocolate cookie",
    ingredients: ["Maida", "Sugar", "Refined Palm Oil", "Milk Solids", "Cocoa", "Salt"],
    conditions: ["Diabetic", "Heart Condition", "Lactose Intolerant"],
    mustMatch: [
      "condition.diabetic.added_sugar",
      "condition.diabetic.refined_carbs",
      "condition.heart.palm_oil",
      "condition.lactose.dairy",
    ],
    minPenalty: 50,
  },
];

// ── Runner ─────────────────────────────────────────────────────────────────

interface CaseResult {
  name: string;
  pass: boolean;
  failures: string[];
  matched: MatchResult[];
  penalty: number;
}

function runCase(c: GoldenCase): CaseResult {
  const failures: string[] = [];
  const matched = matchUserProfile({
    ingredients: c.ingredients,
    conditions: c.conditions ?? [],
    allergies: c.allergies ?? [],
  });
  const ruleIds = new Set(matched.map((m) => m.rule_id));

  for (const expected of c.mustMatch) {
    if (!ruleIds.has(expected)) {
      failures.push(`recall miss: expected ${expected} to fire`);
    }
  }
  for (const forbidden of c.mustNotMatch ?? []) {
    if (ruleIds.has(forbidden)) {
      failures.push(`precision fail: ${forbidden} should NOT have fired`);
    }
  }
  if (c.severityFor) {
    for (const [rid, expectedSev] of Object.entries(c.severityFor)) {
      const m = matched.find((x) => x.rule_id === rid);
      if (m && m.severity !== expectedSev) {
        failures.push(`severity mismatch: ${rid} expected ${expectedSev}, got ${m.severity}`);
      }
    }
  }
  const penalty = personalizationPenalty(matched);
  if (c.minPenalty != null && penalty < c.minPenalty) {
    failures.push(`penalty too low: expected >= ${c.minPenalty}, got ${penalty}`);
  }

  return { name: c.name, pass: failures.length === 0, failures, matched, penalty };
}

function runUnitTests(): { pass: boolean; failures: string[] } {
  const failures: string[] = [];

  // normalize collapses punctuation + spaces
  const n = normalize("  Refined  Wheat-Flour (Maida)  ");
  if (n !== "refined wheat-flour maida") failures.push(`normalize mismatch: got "${n}"`);

  // dedupeProfile trims, dedupes case-insensitively, caps length
  const d = dedupeProfile([" Peanuts ", "peanuts", "Milk", "MILK", "", "x".repeat(80)]);
  if (d.length !== 2) failures.push(`dedupeProfile length expected 2, got ${d.length} (${JSON.stringify(d)})`);
  if (!d.includes("Peanuts") || !d.includes("Milk")) failures.push(`dedupeProfile content wrong: ${JSON.stringify(d)}`);

  // dedupeProfile caps to 30
  const big = Array.from({ length: 50 }, (_, i) => `Allergy${i}`);
  if (dedupeProfile(big).length !== 30) failures.push(`dedupeProfile cap broken`);

  // applyPenalty floors at 0 and respects null
  if (applyPenalty(null, []) !== null) failures.push(`applyPenalty(null) should stay null`);
  if (applyPenalty(80, []) !== 80) failures.push(`applyPenalty zero matches should be unchanged`);
  const seriousMatch: MatchResult = {
    rule_id: "x", kind: "allergy", related_condition: "Peanuts", triggering_ingredient: "Peanut",
    matched_term: "peanut", severity: "serious", warning: "x",
  };
  const lowered = applyPenalty(80, [seriousMatch]);
  if (lowered == null || lowered >= 80) failures.push(`applyPenalty serious should reduce, got ${lowered}`);

  // profileHash is order-independent + case-insensitive
  const h1 = profileHash(["Diabetic", "Heart"], ["Peanuts", "Milk"]);
  const h2 = profileHash(["heart", "diabetic"], ["milk", "peanuts"]);
  if (h1 !== h2) failures.push(`profileHash should be order/case-insensitive`);

  // No empty rule lists
  for (const g of __INTERNAL.ALLERGY_GROUPS) {
    if (g.userTerms.length === 0) failures.push(`allergy ${g.id} has no userTerms`);
    if (g.patterns.length === 0) failures.push(`allergy ${g.id} has no patterns`);
  }
  for (const g of __INTERNAL.CONDITION_GROUPS) {
    if (g.userTerms.length === 0) failures.push(`condition ${g.id} has no userTerms`);
    if (g.flags.length === 0) failures.push(`condition ${g.id} has no flags`);
  }

  // personalizedScore floors at 0 and never raises
  if (personalizedScore(50, 0) !== 50) failures.push(`personalizedScore zero penalty should be unchanged`);
  if (personalizedScore(50, 30) !== 20) failures.push(`personalizedScore arithmetic broken`);
  if (personalizedScore(10, 50) !== 0) failures.push(`personalizedScore should floor at 0`);
  if (personalizedScore(null, 30) !== null) failures.push(`personalizedScore(null) should stay null`);

  return { pass: failures.length === 0, failures };
}

async function runIntegrationTests(): Promise<{ pass: boolean; failures: string[] }> {
  const failures: string[] = [];

  // Empty profile → fast-path empty result, no LLM
  const empty = await getPersonalizedAnalysis(["sugar", "salt"], [], [], { useLLM: false });
  if (empty.warnings.length !== 0) failures.push(`empty profile should return zero warnings`);
  if (empty.penalty !== 0) failures.push(`empty profile penalty should be 0, got ${empty.penalty}`);
  if (empty.llmCalled) failures.push(`empty profile should not call LLM`);

  // Real profile → deterministic-only mode produces matches with shape
  const r = await getPersonalizedAnalysis(
    ["Maida", "Sugar", "Refined Palm Oil", "Salt"],
    ["Diabetic", "Heart Condition"],
    [],
    { useLLM: false },
  );
  if (r.warnings.length === 0) failures.push(`expected at least one deterministic warning`);
  if (r.deterministicCount !== r.warnings.length) failures.push(`deterministicCount should equal warnings.length when useLLM:false`);
  if (r.llmCount !== 0) failures.push(`llmCount should be 0 when useLLM:false`);
  if (r.llmCalled) failures.push(`LLM should not be called when useLLM:false`);
  if (r.penalty <= 0) failures.push(`penalty should be > 0 for matched product, got ${r.penalty}`);
  for (const w of r.warnings) {
    if (!w.warning || !w.related_condition || !w.triggering_ingredient || !w.severity) {
      failures.push(`warning shape incomplete: ${JSON.stringify(w)}`);
    }
    if (w.source !== "deterministic") failures.push(`warning.source should be "deterministic", got "${w.source}"`);
    if (!w.rule_id?.startsWith("condition.") && !w.rule_id?.startsWith("allergy.")) {
      failures.push(`rule_id should be namespaced, got "${w.rule_id}"`);
    }
  }

  return { pass: failures.length === 0, failures };
}

async function main(): Promise<void> {
  const filter = process.argv.find((a, i) => i > 1 && process.argv[i - 1] === "--case");

  console.log("──────────────────────────────────────────────────");
  console.log("  Sift personalization QC harness");
  console.log("──────────────────────────────────────────────────\n");

  let passed = 0;
  let failed = 0;
  const failedNames: string[] = [];

  // Unit tests first.
  const unit = runUnitTests();
  if (unit.pass) {
    console.log("  [unit] PASS — normalization, dedupe, penalty, hash, personalizedScore");
    passed += 1;
  } else {
    console.log("  [unit] FAIL");
    for (const f of unit.failures) console.log(`         · ${f}`);
    failed += 1;
    failedNames.push("unit tests");
  }

  // Integration: end-to-end through getPersonalizedAnalysis (deterministic-only)
  const integ = await runIntegrationTests();
  if (integ.pass) {
    console.log("  [integ] PASS — getPersonalizedAnalysis shape + flow");
    passed += 1;
  } else {
    console.log("  [integ] FAIL");
    for (const f of integ.failures) console.log(`         · ${f}`);
    failed += 1;
    failedNames.push("integration tests");
  }

  console.log("");

  for (const c of GOLDEN) {
    if (filter && !c.name.includes(filter)) continue;
    const r = runCase(c);
    const pad = r.pass ? "PASS" : "FAIL";
    console.log(`  [${pad}] ${c.name}`);
    if (!r.pass) {
      for (const f of r.failures) console.log(`         · ${f}`);
      console.log(`         · matched rule_ids: ${r.matched.map((m) => m.rule_id).join(", ") || "(none)"}`);
      console.log(`         · penalty: ${r.penalty}`);
      failedNames.push(c.name);
      failed += 1;
    } else {
      passed += 1;
    }
  }

  const total = passed + failed;
  console.log("");
  console.log("──────────────────────────────────────────────────");
  console.log(`  Total: ${total}   Pass: ${passed}   Fail: ${failed}`);
  console.log("──────────────────────────────────────────────────");
  if (failed > 0) {
    console.log("\nFailed cases:");
    for (const n of failedNames) console.log(`  · ${n}`);
    process.exit(1);
  }
  console.log("\nAll personalization QC checks passed.");
}

main().catch((err) => {
  console.error("QC harness crashed:", err);
  process.exit(1);
});
