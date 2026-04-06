import { anthropic, MODEL } from "./anthropic";
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

const SAFETY_EXPERT_PROMPT = [
  "You are an expert food and cosmetic safety analyst for the Indian market.",
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

// ── Tool Definitions ────────────────────────────────────────────────────────────

const ANALYSIS_TOOL = {
  name: "submit_analysis" as const,
  description: "Submit the complete safety analysis for a product",
  input_schema: {
    type: "object" as const,
    required: ["score", "grade", "summary", "ingredients", "warnings", "healthier_tip"],
    properties: {
      score: { type: "number" as const, description: "Safety score 0-100" },
      grade: { type: "string" as const, enum: ["A", "B", "C", "D", "E"] },
      summary: {
        type: "string" as const,
        description: "2-3 sentence plain-English summary for an Indian consumer",
      },
      ingredients: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["name", "risk_level", "explanation"],
          properties: {
            name: { type: "string" as const },
            risk_level: { type: "string" as const, enum: ["safe", "caution", "warning", "danger"] },
            explanation: {
              type: "string" as const,
              description: "Brief explanation referencing FSSAI/WHO/ICMR limits where applicable",
            },
          },
        },
      },
      warnings: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Critical warnings the consumer must know",
      },
      healthier_tip: {
        type: "string" as const,
        description: "One actionable tip for a healthier alternative, specific to India",
      },
    },
  },
};

const LABEL_EXTRACTION_TOOL = {
  name: "submit_label_data" as const,
  description: "Submit extracted data from a product label image",
  input_schema: {
    type: "object" as const,
    required: [
      "product_name",
      "brand",
      "ingredients",
      "nutritional_info",
      "fssai_license",
      "claims",
      "category_guess",
    ],
    properties: {
      product_name: { type: "string" as const },
      brand: { type: "string" as const },
      ingredients: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Each ingredient separately, preserving INS numbers in parentheses",
      },
      nutritional_info: {
        type: "object" as const,
        description: "Key nutritional values per serving/100g",
      },
      fssai_license: {
        type: ["string", "null"] as const,
        description: "FSSAI license number if visible",
      },
      claims: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "Marketing claims on the label",
      },
      category_guess: {
        type: "string" as const,
        description:
          "Product category: food, beverage, snack, dairy, baby_food, skincare, haircare, cosmetic, household",
      },
    },
  },
};

const PERSONALIZED_WARNINGS_TOOL = {
  name: "submit_warnings" as const,
  description: "Submit personalized health warnings",
  input_schema: {
    type: "object" as const,
    required: ["warnings"],
    properties: {
      warnings: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["warning", "severity", "related_condition", "triggering_ingredient"],
          properties: {
            warning: { type: "string" as const },
            severity: { type: "string" as const, enum: ["info", "moderate", "serious"] },
            related_condition: { type: "string" as const },
            triggering_ingredient: { type: "string" as const },
          },
        },
      },
    },
  },
};

// ── Helper ──────────────────────────────────────────────────────────────────────

function extractToolInput<T>(
  response: { content: Array<{ type: string; input?: unknown }> },
  errorMessage: string
): T {
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(errorMessage);
  }
  return toolUse.input as T;
}

function scoreToGrade(score: number): ScoreGrade {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "E";
}

// ── Functions ──────────────────────────────────────────────────────────────────

export async function analyzeIngredients(
  ingredients: string[],
  category: string
): Promise<SafetyAnalysis> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SAFETY_EXPERT_PROMPT,
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: "tool", name: "submit_analysis" },
    messages: [
      {
        role: "user",
        content: [
          `Analyze the safety of this ${category} product sold in India.`,
          "",
          `Ingredients list: ${ingredients.join(", ")}`,
          "",
          "For each ingredient:",
          "1. Identify its INS number if applicable",
          "2. Note FSSAI permitted limits and whether typical usage is concerning",
          "3. Flag any WHO/ICMR threshold violations",
          "4. Consider Indian dietary context (diabetes, heart disease prevalence)",
          "",
          "Be specific and actionable.",
        ].join("\n"),
      },
    ],
  });

  const result = extractToolInput<SafetyAnalysis>(response, "AI did not return structured analysis");

  result.score = Math.max(0, Math.min(100, Math.round(result.score)));
  result.grade = scoreToGrade(result.score);

  return result;
}

export async function analyzeLabel(base64Image: string): Promise<LabelExtraction> {
  const imageData = base64Image.replace(/^data:image\/\w+;base64,/, "");

  let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
  if (base64Image.startsWith("data:image/png")) {
    mediaType = "image/png";
  } else if (base64Image.startsWith("data:image/webp")) {
    mediaType = "image/webp";
  } else if (base64Image.startsWith("data:image/gif")) {
    mediaType = "image/gif";
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
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
    tools: [LABEL_EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "submit_label_data" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageData },
          },
          {
            type: "text",
            text: "Extract all product information from this Indian product label. Read ingredients carefully, including INS numbers.",
          },
        ],
      },
    ],
  });

  return extractToolInput<LabelExtraction>(response, "AI could not extract label information");
}

export async function getPersonalizedWarnings(
  ingredients: string[],
  healthConditions: string[],
  allergies: string[]
): Promise<PersonalizedWarning[]> {
  if (healthConditions.length === 0 && allergies.length === 0) {
    return [];
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
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
    tools: [PERSONALIZED_WARNINGS_TOOL],
    tool_choice: { type: "tool", name: "submit_warnings" },
    messages: [
      {
        role: "user",
        content: [
          "User health profile:",
          `- Conditions: ${healthConditions.join(", ") || "None"}`,
          `- Allergies: ${allergies.join(", ") || "None"}`,
          "",
          `Product ingredients: ${ingredients.join(", ")}`,
          "",
          "Identify specific risks for this user.",
        ].join("\n"),
      },
    ],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return [];
  }

  const result = toolUse.input as { warnings: PersonalizedWarning[] };
  return result.warnings;
}
