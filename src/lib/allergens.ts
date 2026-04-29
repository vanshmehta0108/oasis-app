// Deterministic personalization matcher.
//
// This is a high-precision synonym/normalization layer that runs BEFORE the
// LLM. It maps a user's allergies and health conditions to known triggering
// ingredients using curated lists tuned for the Indian market — hindi names,
// regional terms, INS codes, and common ingredient-list spellings.
//
// Rules of engagement:
//   - High precision over high recall. If a match is ambiguous (e.g. bare
//     "milk" with possible "almond milk" prefix), exclude it. The LLM in
//     getPersonalizedWarnings will catch what we miss.
//   - Every rule has a stable `rule_id` so the QC harness can assert
//     specific (input, profile) → (rule_id) mappings.
//   - No regex backtracking traps — patterns are simple word-boundary
//     literal matches, optionally with a list of prefixes to exclude.

export type Severity = "info" | "moderate" | "serious";
export type RuleKind = "allergy" | "condition";

export interface MatchResult {
  rule_id: string;
  kind: RuleKind;
  related_condition: string;        // user-facing label, e.g. "Diabetic" or "Peanuts allergy"
  triggering_ingredient: string;    // the ingredient string from the input that matched
  matched_term: string;             // the canonical synonym that fired
  severity: Severity;
  warning: string;
}

interface Pattern {
  // Lowercase substrings to look for. Match is on word-boundary basis when
  // the pattern is purely alphabetic; substring otherwise (so "ins 220"
  // still matches "(ins 220)").
  terms: readonly string[];
  // Optional list of prefixes that DISQUALIFY a match. Used to avoid
  // false positives like "almond milk" hitting a dairy rule.
  excludePrefixes?: readonly string[];
}

interface AllergyGroup {
  id: string;                         // stable rule id, e.g. "allergy.peanuts"
  label: string;                      // user-facing label
  userTerms: readonly string[];       // strings the user might have entered (normalized)
  patterns: readonly Pattern[];       // patterns that match against ingredients
  severity: Severity;
  warning: string;                    // {{ingredient}} placeholder gets substituted
}

interface ConditionFlag {
  rule_id: string;
  patterns: readonly Pattern[];
  severity: Severity;
  warning: string;
}

interface ConditionGroup {
  id: string;                         // stable rule id, e.g. "condition.diabetic"
  label: string;                      // user-facing label
  userTerms: readonly string[];
  flags: readonly ConditionFlag[];
}

// ── Normalization ─────────────────────────────────────────────────────────

const PUNCT_RE = /[.,;:()/\\[\]{}!?"`]/g;
const WS_RE = /\s+/g;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/–|—/g, "-")
    .replace(PUNCT_RE, " ")
    .replace(WS_RE, " ")
    .trim();
}

// Trim, collapse whitespace, lowercase-key for de-duplication.
export function normalizeUserInput(s: string): string {
  return s.trim().replace(WS_RE, " ");
}

export function dedupeProfile(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const cleaned = normalizeUserInput(raw);
    if (!cleaned) continue;
    if (cleaned.length > 60) continue;            // sanity cap
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out.slice(0, 30);                         // hard cap on profile entries
}

// ── Allergy synonym tables ────────────────────────────────────────────────

const ALLERGY_GROUPS: readonly AllergyGroup[] = [
  {
    id: "allergy.peanuts",
    label: "Peanuts",
    userTerms: ["peanut", "peanuts", "groundnut", "groundnuts", "moongfali", "mungphali"],
    severity: "serious",
    warning: "Contains {{ingredient}} — direct peanut exposure.",
    patterns: [
      { terms: ["peanut", "peanuts", "peanut butter", "peanut oil", "groundnut", "groundnut oil", "moongfali", "mungphali", "arachis hypogaea"] },
    ],
  },
  {
    id: "allergy.tree_nuts",
    label: "Tree Nuts",
    userTerms: ["tree nut", "tree nuts", "nuts"],
    severity: "serious",
    warning: "Contains {{ingredient}} — flagged for tree-nut allergy.",
    patterns: [
      { terms: ["almond", "almonds", "badam", "cashew", "cashews", "kaju", "walnut", "walnuts", "akhrot", "pistachio", "pistachios", "pista", "hazelnut", "hazelnuts", "pecan", "pecans", "brazil nut", "brazil nuts", "macadamia", "mixed nuts", "tree nut", "tree nuts"] },
    ],
  },
  {
    id: "allergy.milk",
    label: "Milk",
    userTerms: ["milk", "dairy", "lactose"],
    severity: "serious",
    warning: "Contains {{ingredient}} — dairy.",
    patterns: [
      // Unambiguous dairy markers
      { terms: ["milk solids", "milk powder", "skimmed milk", "skim milk", "whole milk", "full cream milk", "milk fat", "milk protein", "milk powder", "condensed milk", "sweetened condensed milk", "evaporated milk", "buttermilk", "whey", "whey powder", "whey protein", "casein", "caseinate", "calcium caseinate", "sodium caseinate", "lactose", "lactalbumin", "lactoglobulin", "ghee", "paneer", "khoya", "khoa", "dahi", "curd", "yogurt", "yoghurt", "cheese", "cream", "butter oil", "butterfat", "anhydrous milk fat", "amf"] },
      // Bare "milk" with non-plant prefix exclusion
      { terms: ["milk"], excludePrefixes: ["almond", "soy", "soya", "coconut", "oat", "rice", "cashew", "hazelnut", "hemp", "pea"] },
      // Bare "butter" excluding nut butters
      { terms: ["butter"], excludePrefixes: ["peanut", "almond", "cashew", "nut", "cocoa", "shea", "coconut"] },
    ],
  },
  {
    id: "allergy.soy",
    label: "Soy",
    userTerms: ["soy", "soya", "soybean", "soybeans"],
    severity: "moderate",
    warning: "Contains {{ingredient}} — soy.",
    patterns: [
      { terms: ["soy", "soya", "soy bean", "soya bean", "soybean", "soybeans", "soy protein", "soya protein", "soy flour", "soya flour", "soy lecithin", "soya lecithin", "soy oil", "soya oil", "soybean oil", "textured soy protein", "tsp", "tofu"] },
    ],
  },
  {
    id: "allergy.eggs",
    label: "Eggs",
    userTerms: ["egg", "eggs"],
    severity: "serious",
    warning: "Contains {{ingredient}} — egg.",
    patterns: [
      { terms: ["egg", "eggs", "egg white", "egg yolk", "albumen", "albumin", "ovalbumin", "lysozyme", "egg powder", "whole egg", "anda"] },
    ],
  },
  {
    id: "allergy.gluten",
    label: "Gluten",
    userTerms: ["gluten", "wheat"],
    severity: "serious",
    warning: "Contains {{ingredient}} — gluten source.",
    patterns: [
      { terms: ["wheat", "wheat flour", "whole wheat", "whole wheat flour", "atta", "maida", "refined wheat flour", "sooji", "suji", "rava", "semolina", "wheat bran", "durum", "durum wheat", "wheat protein", "wheat starch", "vital wheat gluten", "vital gluten", "gluten", "hydrolysed wheat", "hydrolyzed wheat", "barley", "malt", "malt extract", "malted barley", "malted wheat", "rye", "triticale", "spelt", "kamut", "farro", "bulgur"] },
    ],
  },
  {
    id: "allergy.shellfish",
    label: "Shellfish",
    userTerms: ["shellfish", "crustacean", "crustaceans"],
    severity: "serious",
    warning: "Contains {{ingredient}} — shellfish.",
    patterns: [
      { terms: ["shrimp", "prawn", "prawns", "crab", "crab meat", "lobster", "crayfish", "krill", "langoustine", "scampi"] },
    ],
  },
  {
    id: "allergy.fish",
    label: "Fish",
    userTerms: ["fish"],
    severity: "serious",
    warning: "Contains {{ingredient}} — fish.",
    patterns: [
      { terms: ["fish", "anchovy", "anchovies", "salmon", "tuna", "sardine", "sardines", "mackerel", "tilapia", "cod", "fish sauce", "fish oil", "fish stock", "bonito", "katsuobushi"] },
    ],
  },
  {
    id: "allergy.sulfites",
    label: "Sulfites",
    userTerms: ["sulfite", "sulfites", "sulphite", "sulphites"],
    severity: "moderate",
    warning: "Contains {{ingredient}} — sulfites can trigger asthmatic reactions.",
    patterns: [
      { terms: ["sulfite", "sulfites", "sulphite", "sulphites", "sulfur dioxide", "sulphur dioxide", "sodium metabisulfite", "sodium metabisulphite", "potassium metabisulfite", "potassium metabisulphite", "ins 220", "ins 221", "ins 222", "ins 223", "ins 224", "ins 225", "ins 226", "ins 227", "ins 228", "e220", "e221", "e222", "e223", "e224", "e225", "e226", "e227", "e228"] },
    ],
  },
  {
    id: "allergy.sesame",
    label: "Sesame",
    userTerms: ["sesame", "til"],
    severity: "moderate",
    warning: "Contains {{ingredient}} — sesame.",
    patterns: [
      { terms: ["sesame", "sesame seed", "sesame seeds", "sesame oil", "til", "gingelly", "gingelly oil", "tahini", "tahina"] },
    ],
  },
  {
    id: "allergy.mustard",
    label: "Mustard",
    userTerms: ["mustard", "sarson"],
    severity: "moderate",
    warning: "Contains {{ingredient}} — mustard.",
    patterns: [
      { terms: ["mustard", "mustard seed", "mustard seeds", "mustard oil", "sarson", "sarson oil", "rai", "kasundi"] },
    ],
  },
  {
    id: "allergy.tartrazine",
    label: "Tartrazine (INS 102)",
    userTerms: ["tartrazine", "ins 102", "yellow 5"],
    severity: "moderate",
    warning: "Contains {{ingredient}} — Tartrazine can trigger reactions in aspirin-sensitive individuals.",
    patterns: [
      { terms: ["tartrazine", "ins 102", "e102", "yellow 5", "fd&c yellow 5"] },
    ],
  },
];

// ── Condition flag tables ─────────────────────────────────────────────────

const CONDITION_GROUPS: readonly ConditionGroup[] = [
  {
    id: "condition.diabetic",
    label: "Diabetic",
    userTerms: ["diabetic", "diabetes", "diabetes type 1", "diabetes type 2", "type 1 diabetes", "type 2 diabetes", "t1d", "t2d", "pre-diabetic", "prediabetic"],
    flags: [
      {
        rule_id: "condition.diabetic.added_sugar",
        severity: "serious",
        warning: "{{ingredient}} — added sugar spikes blood glucose.",
        patterns: [
          { terms: ["sugar", "sucrose", "cane sugar", "white sugar", "brown sugar", "demerara sugar", "icing sugar", "powdered sugar", "caster sugar", "palm sugar", "coconut sugar", "jaggery", "gud", "shakkar", "khand"] },
          { terms: ["glucose", "dextrose", "fructose", "high fructose corn syrup", "hfcs", "corn syrup", "invert sugar", "invert syrup", "golden syrup", "treacle", "molasses", "malt syrup", "rice syrup", "agave", "agave syrup", "honey", "shahad", "maple syrup", "fruit juice concentrate", "fruit concentrate"] },
        ],
      },
      {
        rule_id: "condition.diabetic.refined_carbs",
        severity: "moderate",
        warning: "{{ingredient}} — refined carbs raise GI rapidly for diabetics.",
        patterns: [
          { terms: ["maida", "refined wheat flour", "refined flour", "all purpose flour", "all-purpose flour", "white flour", "sooji", "suji", "rava", "semolina"] },
          { terms: ["maltodextrin", "modified starch", "modified corn starch", "dextrin", "white rice", "puffed rice"] },
        ],
      },
    ],
  },
  {
    id: "condition.hypertension",
    label: "High BP",
    userTerms: ["high bp", "high blood pressure", "hypertension", "hypertensive", "bp", "blood pressure"],
    flags: [
      {
        rule_id: "condition.hypertension.sodium",
        severity: "moderate",
        warning: "{{ingredient}} — sodium drives blood pressure up.",
        patterns: [
          { terms: ["salt", "iodised salt", "iodized salt", "sodium chloride", "rock salt", "sendha namak", "namak", "table salt", "sea salt", "kala namak"] },
          { terms: ["monosodium glutamate", "msg", "ins 621", "e621", "disodium inosinate", "ins 631", "e631", "disodium guanylate", "ins 627", "e627"] },
          { terms: ["sodium nitrite", "sodium nitrate", "ins 250", "ins 251", "e250", "e251", "sodium benzoate", "ins 211", "e211", "sodium bicarbonate", "baking soda", "ins 500", "e500"] },
        ],
      },
    ],
  },
  {
    id: "condition.heart",
    label: "Heart Condition",
    userTerms: ["heart", "heart condition", "heart disease", "cardiac", "cardiovascular", "high cholesterol", "cholesterol"],
    flags: [
      {
        rule_id: "condition.heart.trans_fats",
        severity: "serious",
        warning: "{{ingredient}} — trans fats are a leading driver of heart disease (banned in many countries).",
        patterns: [
          { terms: ["partially hydrogenated", "hydrogenated vegetable oil", "hydrogenated oil", "hydrogenated fat", "vanaspati", "trans fat", "trans-fat", "shortening", "margarine"] },
        ],
      },
      {
        rule_id: "condition.heart.palm_oil",
        severity: "moderate",
        warning: "{{ingredient}} — palm oil is high in saturated fat.",
        patterns: [
          { terms: ["palm oil", "palmolein", "palm olein", "palm kernel oil", "palm fat", "rbd palm oil", "rbd palmolein"] },
        ],
      },
    ],
  },
  {
    id: "condition.lactose",
    label: "Lactose Intolerant",
    userTerms: ["lactose", "lactose intolerant", "lactose intolerance"],
    flags: [
      {
        rule_id: "condition.lactose.dairy",
        severity: "serious",
        warning: "{{ingredient}} — contains lactose.",
        patterns: [
          { terms: ["milk solids", "milk powder", "skimmed milk", "skim milk", "whole milk", "full cream milk", "milk protein", "condensed milk", "sweetened condensed milk", "evaporated milk", "buttermilk", "whey", "whey powder", "whey protein", "lactose", "casein", "caseinate", "khoya", "khoa", "paneer", "dahi", "curd", "yogurt", "yoghurt", "cheese", "cream"] },
          { terms: ["milk"], excludePrefixes: ["almond", "soy", "soya", "coconut", "oat", "rice", "cashew", "hazelnut", "hemp", "pea"] },
        ],
      },
      {
        rule_id: "condition.lactose.dairy_fat",
        severity: "info",
        warning: "{{ingredient}} — minimal lactose but still a dairy fat.",
        patterns: [
          { terms: ["ghee", "butter oil", "butterfat", "anhydrous milk fat", "amf"] },
        ],
      },
    ],
  },
  {
    id: "condition.gluten",
    label: "Gluten Sensitive",
    userTerms: ["gluten", "gluten sensitive", "gluten sensitivity", "celiac", "coeliac"],
    flags: [
      {
        rule_id: "condition.gluten.wheat",
        severity: "serious",
        warning: "{{ingredient}} — contains gluten.",
        patterns: [
          { terms: ["wheat", "wheat flour", "whole wheat", "atta", "maida", "refined wheat flour", "sooji", "suji", "rava", "semolina", "wheat bran", "durum", "durum wheat", "wheat protein", "wheat starch", "vital wheat gluten", "vital gluten", "gluten", "hydrolysed wheat", "hydrolyzed wheat", "barley", "malt", "malt extract", "malted barley", "malted wheat", "rye", "triticale", "spelt", "kamut", "farro", "bulgur"] },
        ],
      },
      {
        rule_id: "condition.gluten.oats",
        severity: "info",
        warning: "{{ingredient}} — oats can be cross-contaminated with gluten unless certified gluten-free.",
        patterns: [
          { terms: ["oats", "oat flour", "rolled oats", "instant oats"], excludePrefixes: ["gluten-free", "gluten free", "certified gf"] },
        ],
      },
    ],
  },
  {
    id: "condition.pcod",
    label: "PCOD / PCOS",
    userTerms: ["pcod", "pcos", "polycystic"],
    flags: [
      {
        rule_id: "condition.pcod.sugar",
        severity: "moderate",
        warning: "{{ingredient}} — refined sugar worsens insulin resistance in PCOS.",
        patterns: [
          { terms: ["sugar", "sucrose", "cane sugar", "white sugar", "brown sugar", "high fructose corn syrup", "hfcs", "corn syrup", "invert sugar", "fructose", "glucose syrup", "dextrose"] },
          { terms: ["maltodextrin", "maida", "refined wheat flour", "refined flour", "white flour"] },
        ],
      },
    ],
  },
  {
    id: "condition.thyroid",
    label: "Thyroid",
    userTerms: ["thyroid", "hypothyroid", "hyperthyroid", "hypothyroidism", "hyperthyroidism"],
    flags: [
      {
        rule_id: "condition.thyroid.soy",
        severity: "moderate",
        warning: "{{ingredient}} — soy can interfere with thyroid medication absorption.",
        patterns: [
          { terms: ["soy", "soya", "soybean", "soy protein", "soya protein", "soy lecithin", "soya lecithin", "soy flour", "soya flour", "tofu"] },
        ],
      },
    ],
  },
  {
    id: "condition.kidney",
    label: "Kidney Disease",
    userTerms: ["kidney", "kidney disease", "ckd", "renal", "renal disease"],
    flags: [
      {
        rule_id: "condition.kidney.phosphates",
        severity: "serious",
        warning: "{{ingredient}} — phosphate additives are tightly restricted in CKD diets.",
        patterns: [
          { terms: ["phosphoric acid", "ins 338", "e338", "ins 339", "e339", "ins 340", "e340", "ins 341", "e341", "ins 450", "e450", "ins 451", "e451", "ins 452", "e452", "sodium phosphate", "potassium phosphate", "calcium phosphate", "diphosphates", "triphosphates", "polyphosphates"] },
        ],
      },
      {
        rule_id: "condition.kidney.potassium",
        severity: "moderate",
        warning: "{{ingredient}} — added potassium needs monitoring in CKD.",
        patterns: [
          { terms: ["potassium chloride", "ins 508", "e508"] },
        ],
      },
    ],
  },
  {
    id: "condition.pku",
    label: "PKU",
    userTerms: ["pku", "phenylketonuria"],
    flags: [
      {
        rule_id: "condition.pku.aspartame",
        severity: "serious",
        warning: "{{ingredient}} — Aspartame is dangerous for PKU patients (contains phenylalanine).",
        patterns: [
          { terms: ["aspartame", "ins 951", "e951", "nutrasweet", "equal"] },
        ],
      },
    ],
  },
  {
    id: "condition.pregnant",
    label: "Pregnant",
    userTerms: ["pregnant", "pregnancy"],
    flags: [
      {
        rule_id: "condition.pregnant.alcohol",
        severity: "serious",
        warning: "{{ingredient}} — alcohol is unsafe during pregnancy.",
        patterns: [
          { terms: ["alcohol", "ethanol", "ethyl alcohol", "wine", "rum", "brandy", "whisky", "whiskey"] },
        ],
      },
      {
        rule_id: "condition.pregnant.caffeine",
        severity: "info",
        warning: "{{ingredient}} — keep total caffeine under 200 mg/day during pregnancy.",
        patterns: [
          { terms: ["caffeine", "added caffeine"] },
        ],
      },
    ],
  },
];

// ── Matcher core ─────────────────────────────────────────────────────────

function matchesPattern(normalizedIngredient: string, pattern: Pattern): string | null {
  for (const term of pattern.terms) {
    const idx = findTerm(normalizedIngredient, term);
    if (idx < 0) continue;
    if (pattern.excludePrefixes && hasExcludedPrefix(normalizedIngredient, idx, pattern.excludePrefixes)) continue;
    return term;
  }
  return null;
}

// Find a term inside the haystack on a word-boundary basis when the term
// is purely alphabetic. For terms that already include digits/spaces (like
// "ins 220" or "milk solids") fall back to substring search — those are
// already specific enough.
function findTerm(haystack: string, term: string): number {
  const isWordy = /^[a-z][a-z' -]*$/.test(term);
  if (!isWordy) {
    return haystack.indexOf(term);
  }
  // Word-boundary search: scan all occurrences and check char before/after.
  let from = 0;
  while (from <= haystack.length - term.length) {
    const idx = haystack.indexOf(term, from);
    if (idx < 0) return -1;
    const before = idx === 0 ? " " : haystack[idx - 1];
    const after = idx + term.length >= haystack.length ? " " : haystack[idx + term.length];
    if (!isWord(before) && !isWord(after)) return idx;
    from = idx + 1;
  }
  return -1;
}

function isWord(ch: string): boolean {
  return /[a-z0-9]/i.test(ch);
}

function hasExcludedPrefix(haystack: string, matchIdx: number, prefixes: readonly string[]): boolean {
  // Check if any prefix immediately precedes the match (allowing one space).
  for (const p of prefixes) {
    const candidate = ` ${p} `;
    const before = haystack.slice(0, matchIdx);
    if (before.endsWith(candidate) || before === p + " " || (matchIdx === p.length + 1 && haystack.startsWith(p + " "))) {
      return true;
    }
  }
  return false;
}

function userTermMatches(profileEntry: string, terms: readonly string[]): boolean {
  const norm = profileEntry.toLowerCase().trim();
  for (const t of terms) {
    if (norm === t) return true;
    // Tolerate trailing 's' and "type X" suffixes.
    if (norm === t + "s") return true;
    if (norm === t.replace(/s$/, "")) return true;
    if (norm.startsWith(t + " ")) return true;
  }
  return false;
}

export interface MatchInput {
  ingredients: readonly string[];
  conditions: readonly string[];
  allergies: readonly string[];
}

export function matchUserProfile(input: MatchInput): MatchResult[] {
  const results: MatchResult[] = [];
  const seenKey = new Set<string>();

  // Pre-normalize ingredients once.
  const norm = input.ingredients.map((raw) => ({ raw, n: normalize(raw) }));

  // Allergies
  for (const userAllergy of input.allergies) {
    for (const grp of ALLERGY_GROUPS) {
      if (!userTermMatches(userAllergy, grp.userTerms)) continue;
      for (const ing of norm) {
        for (const pattern of grp.patterns) {
          const matched = matchesPattern(ing.n, pattern);
          if (!matched) continue;
          const key = `${grp.id}|${ing.raw}`;
          if (seenKey.has(key)) continue;
          seenKey.add(key);
          results.push({
            rule_id: grp.id,
            kind: "allergy",
            related_condition: `${grp.label} allergy`,
            triggering_ingredient: ing.raw,
            matched_term: matched,
            severity: grp.severity,
            warning: grp.warning.replace("{{ingredient}}", ing.raw),
          });
        }
      }
    }
  }

  // Conditions
  for (const userCondition of input.conditions) {
    for (const grp of CONDITION_GROUPS) {
      if (!userTermMatches(userCondition, grp.userTerms)) continue;
      for (const flag of grp.flags) {
        for (const ing of norm) {
          for (const pattern of flag.patterns) {
            const matched = matchesPattern(ing.n, pattern);
            if (!matched) continue;
            const key = `${flag.rule_id}|${ing.raw}`;
            if (seenKey.has(key)) continue;
            seenKey.add(key);
            results.push({
              rule_id: flag.rule_id,
              kind: "condition",
              related_condition: grp.label,
              triggering_ingredient: ing.raw,
              matched_term: matched,
              severity: flag.severity,
              warning: flag.warning.replace("{{ingredient}}", ing.raw),
            });
          }
        }
      }
    }
  }

  return results;
}

// Score penalty derived from match severities. Capped so a flagged product
// never goes below 0 and a clean product stays untouched.
//
// Rationale: a serious match (e.g. peanuts in a peanut-allergic user's
// product) should make the displayed score reflect the personal risk —
// a 70/100 product becomes ~30/100 for that user. Moderate matches nudge
// the score; info matches don't shift the score at all.
export function personalizationPenalty(matches: readonly MatchResult[]): number {
  let penalty = 0;
  let serious = 0;
  let moderate = 0;
  for (const m of matches) {
    if (m.severity === "serious") serious += 1;
    else if (m.severity === "moderate") moderate += 1;
  }
  // First serious match: -30. Each additional: -10. Capped at -50 from serious alone.
  if (serious > 0) penalty += Math.min(50, 30 + (serious - 1) * 10);
  // Moderate matches: -5 each, capped at -20 contribution.
  penalty += Math.min(20, moderate * 5);
  // Hard ceiling.
  return Math.min(60, penalty);
}

export function applyPenalty(score: number | null, matches: readonly MatchResult[]): number | null {
  if (score == null) return null;
  const p = personalizationPenalty(matches);
  if (p === 0) return score;
  return Math.max(0, Math.min(100, Math.round(score - p)));
}

// Convenience: flatten matches into the public PersonalizedWarning shape
// that the rest of the app already consumes (scoring.ts & ProductClient).
export interface PersonalizedWarningOut {
  warning: string;
  severity: Severity;
  related_condition: string;
  triggering_ingredient: string;
  rule_id: string;
  source: "deterministic" | "llm";
}

export function matchesToWarnings(matches: readonly MatchResult[]): PersonalizedWarningOut[] {
  return matches.map((m) => ({
    warning: m.warning,
    severity: m.severity,
    related_condition: m.related_condition,
    triggering_ingredient: m.triggering_ingredient,
    rule_id: m.rule_id,
    source: "deterministic",
  }));
}

// Stable hash for cache keys. Not crypto-grade — just collision-resistant
// enough to key an in-memory map. Same input → same string.
export function profileHash(conditions: readonly string[], allergies: readonly string[]): string {
  const c = [...conditions].map((s) => s.toLowerCase().trim()).sort().join("|");
  const a = [...allergies].map((s) => s.toLowerCase().trim()).sort().join("|");
  return `${c}::${a}`;
}

// Test-only export of the rule tables for QC harness coverage assertions.
export const __INTERNAL = {
  ALLERGY_GROUPS,
  CONDITION_GROUPS,
};
