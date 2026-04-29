import { SchemaType, type Schema } from "@google/generative-ai";
import { getGenAI, MODEL } from "./ai";
import type { ScoreGrade } from "./database.types";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface IngredientAnalysis {
  name: string;
  risk_level: "safe" | "caution" | "warning" | "danger";
  explanation: string;
}

export interface SafetyAnalysis {
  score: number;
  grade: ScoreGrade;
  summary: string;
  ingredients: IngredientAnalysis[];
  warnings: string[];
  healthier_tip: string;
}

export interface LabelExtraction {
  product_name: string;
  brand: string;
  ingredients: string[];
  nutritional_info: Record<string, unknown>;
  fssai_license: string | null;
  claims: string[];
  category_guess: string;
}

export interface PersonalizedWarning {
  warning: string;
  severity: "info" | "moderate" | "serious";
  related_condition: string;
  triggering_ingredient: string;
}

// ── System Prompts ─────────────────────────────────────────────────────────────

// Voice rules baked into the system prompt so every Gemini-generated summary
// and healthier_tip lands in the Sift voice. The score / risk_level / INS
// citations stay clinical (those are facts) — but the consumer-facing fields
// must read like a friend at the supermarket, not a regulator.
const VOICE_RULES = [
  "VOICE — applies to `summary`, `warnings`, and `healthier_tip` ONLY:",
  "- Talk like a friend at the supermarket. Confident, calm, never preachy.",
  "- Lead with a verdict, not a description. Use verbs: 'Skip', 'Watch', 'Pick', 'Worth a closer look'.",
  "- Short sentences. One idea per line. No hedging.",
  "- Never use the words 'unhealthy', 'bad', or 'avoid this product'. Use 'we'd skip', 'worth a closer look', 'not great'.",
  "- The summary should make a real-life decision easier in 8–14 words. No buzzwords.",
  "- The healthier_tip should name a specific Indian alternative (a brand, a swap, a category) the user can actually buy. No abstract advice.",
  "- Warnings: state the consequence in plain English. 'High in refined carbs and sugar — not great for diabetics' beats 'May affect blood glucose levels in susceptible individuals.'",
  "- Be honest. If a product is fine, say so cleanly. If it's not, say so cleanly. Hedging is the enemy.",
].join("\n");

const SAFETY_EXPERT_PROMPT = [
  "You are an expert food and cosmetic safety analyst for the Indian market — but you write like a confident friend at the supermarket, not a regulator.",
  "",
  VOICE_RULES,
  "",
  "FSSAI REGULATIONS:",
  "- Food Safety and Standards (Food Product Standards and Food Additives) Regulations, 2011",
  "- Maximum permitted levels for all INS-numbered additives",
  "- Labeling requirements under FSSAI regulations",
  "",
  "KEY INDIAN FOOD ADDITIVES & INS NUMBERS:",
  "- INS 102 (Tartrazine) — azo dye, 100mg/kg limit, common in namkeens/sweets",
  "- INS 110 (Sunset Yellow FCF) — azo dye, 100mg/kg, often combined with tartrazine",
  "- INS 621 (MSG) — allowed in specific categories only, not in infant foods",
  "- INS 211 (Sodium Benzoate) — 200mg/kg in beverages, can form benzene with Vitamin C",
  "- INS 320 (BHA) — 200mg/kg fat basis, possible endocrine disruptor",
  "- INS 321 (BHT) — often paired with BHA, same concerns",
  "- INS 951 (Aspartame) — ADI 40mg/kg body weight, dangerous for PKU patients",
  "- INS 950 (Acesulfame K) — often combined with aspartame",
  "- INS 129 (Allura Red) — linked to hyperactivity in children",
  "- INS 171 (Titanium Dioxide) — banned in EU since 2022, still allowed by FSSAI",
  "- INS 500(ii) (Sodium Hydrogen Carbonate) — generally safe",
  "- INS 330 (Citric Acid) — generally safe",
  "- INS 415 (Xanthan Gum) — generally safe",
  "- INS 412 (Guar Gum) — from Rajasthan, generally safe",
  "- INS 322 (Lecithins) — generally safe, usually from soy",
  "- INS 160b (Annatto) — natural colour, can cause allergies",
  "",
  "WHO/ICMR GUIDELINES:",
  "- Salt: <5g/day (Indian average: 10-11g/day)",
  "- Sugar: <25g free sugars/day",
  "- ICMR-NIN RDA 2020 for Indian population",
  "- Trans-fat: <1% total energy (India banned PHOs in 2022)",
  "",
  "INDIAN DIETARY CONTEXT:",
  "- 77M diabetics — sugar and glycemic load are critical",
  "- 60-70% lactose intolerant adults",
  "- 30-40% vegetarian — check for hidden non-veg (E120, gelatin, L-cysteine)",
  "- Highest heart disease rate globally — sodium, trans fats, saturated fats are priority",
  "- Palm oil ubiquitous — flag it",
  "- Misleading 'no added sugar' with fruit concentrate or maltodextrin",
  "- Maida (refined wheat flour) is nutritionally poor",
  "",
  "COSMETIC/SKINCARE CONTEXT:",
  "- BIS standards IS 4707",
  "- Harmful: parabens, SLS/SLES, formaldehyde releasers (DMDM Hydantoin), phthalates",
  "- Hydroquinone banned >2% in India",
  "- 'Ayurvedic/herbal' claims often mask synthetics",
  "- Lead in kajal/surma — uniquely Indian concern",
  "",
  "SCORING (0-100):",
  "- 80-100 (A): Clean, minimal processing, no concerning additives",
  "- 60-79 (B): Mostly safe, 1-2 minor concerns",
  "- 40-59 (C): Multiple concerns, high sodium/sugar, synthetic additives",
  "- 20-39 (D): Significant concerns — synthetic dyes, high trans fat, misleading labels",
  "- 0-19 (E): Dangerous — banned substances, severely misleading claims",
  "",
  "Be specific. Name INS numbers. Reference FSSAI limits. Cite WHO/ICMR thresholds.",
].join("\n");

// ── Helper ──────────────────────────────────────────────────────────────────────

function scoreToGrade(score: number): ScoreGrade {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "E";
}

function getModel() {
  const client = getGenAI();
  if (!client) {
    throw new Error("GOOGLE_AI_API_KEY is not set. Cannot run AI analysis.");
  }
  return client;
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const ANALYSIS_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.NUMBER, description: "Safety score 0-100" },
    grade: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["A", "B", "C", "D", "E"],
      description: "Letter grade",
    },
    summary: {
      type: SchemaType.STRING,
      description: "2-3 sentence plain-English summary for an Indian consumer",
    },
    ingredients: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          risk_level: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["safe", "caution", "warning", "danger"],
          },
          explanation: {
            type: SchemaType.STRING,
            description: "Brief explanation referencing FSSAI/WHO/ICMR limits where applicable",
          },
        },
        required: ["name", "risk_level", "explanation"],
      },
    },
    warnings: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Critical warnings the consumer must know",
    },
    healthier_tip: {
      type: SchemaType.STRING,
      description: "One actionable tip for a healthier alternative, specific to India",
    },
  },
  required: ["score", "grade", "summary", "ingredients", "warnings", "healthier_tip"],
};

const LABEL_EXTRACTION_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    product_name: { type: SchemaType.STRING },
    brand: { type: SchemaType.STRING },
    ingredients: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Each ingredient separately, preserving INS numbers in parentheses",
    },
    nutritional_info: {
      type: SchemaType.OBJECT,
      properties: {},
      description: "Key nutritional values per serving/100g as key-value pairs",
    },
    fssai_license: {
      type: SchemaType.STRING,
      description: "FSSAI license number if visible, or empty string if not found",
      nullable: true,
    },
    claims: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Marketing claims on the label",
    },
    category_guess: {
      type: SchemaType.STRING,
      description:
        "Product category: food, beverage, snack, dairy, baby_food, skincare, haircare, cosmetic, household",
    },
  },
  required: [
    "product_name",
    "brand",
    "ingredients",
    "nutritional_info",
    "fssai_license",
    "claims",
    "category_guess",
  ],
};

const PERSONALIZED_WARNINGS_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    warnings: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          warning: { type: SchemaType.STRING },
          severity: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["info", "moderate", "serious"],
          },
          related_condition: { type: SchemaType.STRING },
          triggering_ingredient: { type: SchemaType.STRING },
        },
        required: ["warning", "severity", "related_condition", "triggering_ingredient"],
      },
    },
  },
  required: ["warnings"],
};

// ── Functions ──────────────────────────────────────────────────────────────────

export async function analyzeIngredients(
  ingredients: string[],
  category: string,
): Promise<SafetyAnalysis> {
  const client = getModel();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: SAFETY_EXPERT_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA,
    },
  });

  const prompt = [
    `Score this ${category} product sold in India.`,
    "",
    `Ingredients list: ${ingredients.join(", ")}`,
    "",
    "Per-ingredient analysis (keep technical — INS numbers, FSSAI limits, WHO/ICMR thresholds, Indian dietary context):",
    "1. Identify INS number if applicable.",
    "2. Note FSSAI permitted limits and whether typical usage is concerning.",
    "3. Flag any WHO/ICMR threshold violations.",
    "4. Consider Indian dietary context (diabetes, heart disease prevalence, lactose intolerance).",
    "",
    "Do NOT penalise for absence of an FSSAI license number — all products sold in",
    "Indian supermarkets and retail stores are licensed; the license is simply not",
    "always visible in a photo of the ingredient panel.",
    "",
    "VOICE FOR `summary`, `warnings`, `healthier_tip` — re-read the rules above:",
    "- summary: 8–14 words, one decision-shaped sentence. Examples of the bar:",
    "    GOOD: 'Eat occasionally — high sugar and 3 ingredients we'd watch.'",
    "    GOOD: 'Clean enough. No real concerns for daily use.'",
    "    GOOD: 'We'd skip it — palm oil and 2 banned-in-EU additives.'",
    "    BAD:  'This product contains several ingredients of concern that may affect health.'",
    "- healthier_tip: name a real Indian alternative the user can buy today.",
    "    GOOD: 'Try Slurrp Farm Ragi Puffs or Yoga Bar Multigrain Crackers.'",
    "    GOOD: 'Swap for plain salted peanuts or roasted chana from any kirana.'",
    "    BAD:  'Choose products with whole-food ingredients and lower sugar content.'",
    "- warnings: state the consequence plainly. Cite the user-facing risk, not the chemistry.",
    "    GOOD: 'High in refined carbs and sugar — not great for diabetics.'",
    "    BAD:  'May elevate postprandial glucose response in susceptible individuals.'",
  ].join("\n");

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  const result = JSON.parse(text) as SafetyAnalysis;

  result.score = Math.max(0, Math.min(100, Math.round(result.score)));
  result.grade = scoreToGrade(result.score);

  return result;
}

export async function analyzeLabel(base64Image: string): Promise<LabelExtraction> {
  const client = getModel();

  const imageData = base64Image.replace(/^data:image\/\w+;base64,/, "");

  let mimeType = "image/jpeg";
  if (base64Image.startsWith("data:image/png")) {
    mimeType = "image/png";
  } else if (base64Image.startsWith("data:image/webp")) {
    mimeType = "image/webp";
  } else if (base64Image.startsWith("data:image/gif")) {
    mimeType = "image/gif";
  }

  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: [
      "You are an expert at reading Indian product labels. Extract all information precisely.",
      "",
      "Look for:",
      "- FSSAI logo and 14-digit license number (starts with 1 or 2)",
      "- Ingredients list (often tiny print, sometimes Hindi+English)",
      "- Nutritional information panel (per serve and per 100g)",
      "- Veg/Non-veg symbol (green dot = veg, brown/red = non-veg)",
      "- Claims: 'No Maida', 'No Trans Fat', 'Sugar Free', etc.",
      "- INS numbers in parentheses after additive names",
      "",
      "Capture every ingredient. Mark unclear text with [unclear].",
    ].join("\n"),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: LABEL_EXTRACTION_SCHEMA,
    },
  });

  const response = await model.generateContent([
    { inlineData: { mimeType, data: imageData } },
    {
      text: "Extract all product information from this Indian product label. Read ingredients carefully, including INS numbers.",
    },
  ]);

  const text = response.response.text();
  return JSON.parse(text) as LabelExtraction;
}

// Translate a full SafetyAnalysis into another language. Only natural
// language fields get translated — score/grade/risk_level values stay
// canonical so the UI doesn't need per-locale enum handling.
export async function translateAnalysis(
  analysis: SafetyAnalysis,
  targetLang: "hi",
): Promise<SafetyAnalysis> {
  const client = getGenAI();
  if (!client) return analysis;

  const languageName = targetLang === "hi" ? "Hindi (हिंदी, Devanagari script)" : targetLang;

  const TRANSLATE_SCHEMA: Schema = {
    type: SchemaType.OBJECT,
    properties: {
      summary: { type: SchemaType.STRING },
      warnings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      healthier_tip: { type: SchemaType.STRING },
      ingredients: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING },
            explanation: { type: SchemaType.STRING },
          },
          required: ["name", "explanation"],
        },
      },
    },
    required: ["summary", "warnings", "healthier_tip", "ingredients"],
  };

  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: [
      `You translate Indian food safety content into ${languageName}.`,
      "Preserve INS numbers, chemical names in parentheses, and units (mg, g, ml) verbatim.",
      "Keep ingredient names recognizable — for common items, use the familiar Hindi name",
      "but retain the English in parentheses on first mention if it aids clarity.",
      "Translate tone faithfully — alarmist in, alarmist out; neutral in, neutral out.",
    ].join("\n"),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: TRANSLATE_SCHEMA,
    },
  });

  const payload = {
    summary: analysis.summary,
    warnings: analysis.warnings,
    healthier_tip: analysis.healthier_tip,
    ingredients: analysis.ingredients.map((i) => ({ name: i.name, explanation: i.explanation })),
  };

  const res = await model.generateContent(
    `Translate each field of this JSON into ${languageName}. Keep keys unchanged.\n\n${JSON.stringify(payload)}`,
  );
  const translated = JSON.parse(res.response.text()) as typeof payload;

  return {
    ...analysis,
    summary: translated.summary || analysis.summary,
    warnings: translated.warnings?.length ? translated.warnings : analysis.warnings,
    healthier_tip: translated.healthier_tip || analysis.healthier_tip,
    ingredients: analysis.ingredients.map((orig, i) => {
      const t = translated.ingredients?.[i];
      return t
        ? { ...orig, name: t.name || orig.name, explanation: t.explanation || orig.explanation }
        : orig;
    }),
  };
}

export async function getPersonalizedWarnings(
  ingredients: string[],
  healthConditions: string[],
  allergies: string[]
): Promise<PersonalizedWarning[]> {
  if (healthConditions.length === 0 && allergies.length === 0) {
    return [];
  }

  const client = getModel();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: [
      "You are a health advisor specializing in the Indian population.",
      "",
      "COMMON CONDITIONS:",
      "- Diabetes: flag sugars, maida, high-GI ingredients, maltodextrin",
      "- Hypertension: flag sodium, MSG (INS 621), excess salt",
      "- Heart disease: flag trans fats, palm oil, saturated fats, PHOs",
      "- Lactose intolerance (60-70% of adults): flag milk solids, whey, casein",
      "- Celiac/gluten sensitivity: flag wheat, barley, rye, maida, sooji",
      "- PCOD/PCOS: flag high sugar, refined carbs, dairy",
      "- Thyroid: flag soy (interferes with medication)",
      "- Kidney disease: flag potassium, phosphorus additives (INS 338-341, 450-452)",
      "- PKU: flag aspartame (INS 951)",
      "",
      "COMMON ALLERGIES:",
      "- Milk, tree nuts, peanuts, soy, wheat, shellfish, eggs",
      "- Tartrazine (INS 102) sensitivity in aspirin-sensitive individuals",
      "- Sulfite (INS 220-228) sensitivity in asthmatics",
      "",
      "Only return genuinely relevant warnings. Be precise, not alarmist.",
    ].join("\n"),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: PERSONALIZED_WARNINGS_SCHEMA,
    },
  });

  const prompt = [
    "User health profile:",
    `- Conditions: ${healthConditions.join(", ") || "None"}`,
    `- Allergies: ${allergies.join(", ") || "None"}`,
    "",
    `Product ingredients: ${ingredients.join(", ")}`,
    "",
    "Identify specific risks for this user.",
  ].join("\n");

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  const result = JSON.parse(text) as { warnings: PersonalizedWarning[] };
  return result.warnings;
}
