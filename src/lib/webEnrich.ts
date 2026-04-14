// ── Web Enrichment: Extract product data from web search results via AI ────────
//
// When OFF doesn't have a product, we search the web (via Brave) and use
// Gemini to extract structured product info from search result snippets.

import { SchemaType, type Schema } from "@google/generative-ai";
import { getGenAI, MODEL } from "./ai";
import { searchProductByBarcode, searchProductByName } from "./brave";

export interface EnrichedProduct {
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  description: string;
  image_url?: string;
  source_urls: string[];
  confidence: "high" | "medium" | "low";
}

const EXTRACTION_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING, description: "Product name" },
    brand: { type: SchemaType.STRING, description: "Brand or manufacturer" },
    category: {
      type: SchemaType.STRING,
      description: "Product category: food, beverage, snack, skincare, baby, household, cosmetic",
    },
    ingredients: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Individual ingredients extracted from the search results. Split compound lists into individual items.",
    },
    description: {
      type: SchemaType.STRING,
      description: "One-line product description",
    },
    confidence: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["high", "medium", "low"],
      description: "How confident you are in the extraction. high = clear ingredient list found, medium = partial info, low = mostly guessing",
    },
  },
  required: ["name", "brand", "category", "ingredients", "description", "confidence"],
};

/**
 * Extract product data from web search text.
 * Uses fast regex/heuristic extraction first, falls back to AI if needed.
 */
async function extractProductFromText(
  searchText: string,
  hint: string
): Promise<EnrichedProduct | null> {
  // Try fast regex extraction first (no AI needed, < 1ms)
  const fastResult = fastExtractIngredients(searchText, hint);
  if (fastResult && fastResult.ingredients.length >= 3) {
    console.log(`[enrich] Fast extraction found ${fastResult.ingredients.length} ingredients`);
    return fastResult;
  }

  // Fall back to AI extraction if fast method didn't find enough
  const client = getGenAI();
  if (!client) {
    console.warn("Gemini not available — returning fast extraction result");
    return fastResult;
  }

  try {
    const model = client.getGenerativeModel({
      model: MODEL,
      systemInstruction: [
        "You are an expert at extracting product information from web search snippets.",
        "Focus on Indian market products. Extract the FULL ingredients list.",
        "If the search results mention ingredients, extract EVERY single one.",
        "Normalize ingredient names (e.g., 'refined wheat flour' not 'maida (refined wheat flour)').",
        "If the results don't contain enough info, set confidence to 'low'.",
        "Never invent ingredients — only extract what's actually mentioned.",
      ].join("\n"),
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA,
      },
    });

    const prompt = [
      `Extract product information for: ${hint}`,
      "",
      "Web search results:",
      "─".repeat(40),
      searchText.slice(0, 4000), // cap context to save tokens + time
      "─".repeat(40),
      "",
      "Extract the product name, brand, category, and FULL ingredients list.",
      "If multiple products appear, focus on the one matching the hint.",
    ].join("\n");

    const response = await model.generateContent(prompt);
    const text = response.response.text();
    const result = JSON.parse(text);

    return {
      name: result.name || "Unknown Product",
      brand: result.brand || "Unknown Brand",
      category: result.category || "food",
      ingredients: result.ingredients || [],
      description: result.description || "",
      source_urls: [],
      confidence: result.confidence || "low",
    };
  } catch (error) {
    console.error("AI extraction error:", error);
    // Return fast extraction result as fallback
    return fastResult;
  }
}

/**
 * Fast regex-based ingredient extraction from search snippets.
 * No AI call needed — runs in < 1ms.
 */
function fastExtractIngredients(
  text: string,
  hint: string
): EnrichedProduct | null {
  // Common patterns for ingredient lists in search snippets
  const ingredientPatterns = [
    // "Ingredients: X, Y, Z" or "Ingredients list: X, Y, Z"
    /ingredients?\s*(?:list)?\s*[:;]\s*([^.]{20,500})/gi,
    // "made from X, Y, and Z"
    /made\s+(?:from|with|of)\s+([^.]{20,300})/gi,
    // "contains X, Y, Z"
    /contains?\s*[:;]?\s*([^.]{20,300})/gi,
    // "composition: X, Y, Z"
    /composition\s*[:;]\s*([^.]{20,300})/gi,
  ];

  let bestIngredients: string[] = [];

  for (const pattern of ingredientPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const rawList = match[1];
      const ingredients = rawList
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 80)
        .filter((s) => !/^\d+$/.test(s)) // skip pure numbers
        .filter((s) => !/^(and|or|the|with|in|of|a|an)$/i.test(s)); // skip connectors

      if (ingredients.length > bestIngredients.length) {
        bestIngredients = ingredients;
      }
    }
  }

  if (bestIngredients.length === 0) return null;

  // Extract brand and name from hint
  const parts = hint.split(/\s+/);
  const brand = parts.length > 1 ? parts[0] : "Unknown";
  const name = hint;

  // Guess category from ingredients
  let category = "food";
  const lowerText = text.toLowerCase();
  if (lowerText.includes("shampoo") || lowerText.includes("cream") || lowerText.includes("lotion")) category = "skincare";
  else if (lowerText.includes("beverage") || lowerText.includes("juice") || lowerText.includes("drink")) category = "beverage";
  else if (lowerText.includes("snack") || lowerText.includes("chips") || lowerText.includes("namkeen")) category = "snack";
  else if (lowerText.includes("baby") || lowerText.includes("infant")) category = "baby";

  return {
    name,
    brand,
    category,
    ingredients: bestIngredients,
    description: `Product found via web search`,
    source_urls: [],
    confidence: bestIngredients.length >= 5 ? "high" : "medium",
  };
}

/**
 * Enrich a product by barcode using Brave Search + Gemini extraction.
 * This is the fallback when Open Food Facts doesn't have the product.
 */
export async function enrichByBarcode(
  barcode: string
): Promise<EnrichedProduct | null> {
  const searchResult = await searchProductByBarcode(barcode);
  if (!searchResult || searchResult.results.length === 0) return null;

  const product = await extractProductFromText(
    searchResult.raw_text,
    `barcode ${barcode}`
  );

  if (product) {
    product.source_urls = searchResult.results.map((r) => r.url);
  }

  return product;
}

/**
 * Enrich a product by name using Brave Search + Gemini extraction.
 * Useful for adding products manually or from user search.
 */
export async function enrichByName(
  name: string,
  brand?: string
): Promise<EnrichedProduct | null> {
  console.log(`[enrich] Searching Brave for: ${brand ? `${brand} ${name}` : name}`);
  const searchResult = await searchProductByName(name, brand);

  if (!searchResult) {
    console.log("[enrich] Brave search returned null");
    return null;
  }

  if (searchResult.results.length === 0) {
    console.log("[enrich] Brave search returned 0 results");
    return null;
  }

  console.log(`[enrich] Brave returned ${searchResult.results.length} results, extracting with AI...`);

  const product = await extractProductFromText(
    searchResult.raw_text,
    brand ? `${brand} ${name}` : name
  );

  if (!product) {
    console.log("[enrich] AI extraction returned null");
    return null;
  }

  console.log(`[enrich] Extracted: ${product.name} with ${product.ingredients.length} ingredients`);
  product.source_urls = searchResult.results.map((r) => r.url);

  return product;
}

/**
 * Batch enrich: find and extract details for multiple products.
 * Useful for seeding the database with popular Indian products.
 */
export async function batchEnrich(
  items: { name: string; brand?: string }[]
): Promise<(EnrichedProduct | null)[]> {
  // Process sequentially to respect rate limits
  const results: (EnrichedProduct | null)[] = [];
  for (const item of items) {
    const product = await enrichByName(item.name, item.brand);
    results.push(product);
    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return results;
}
