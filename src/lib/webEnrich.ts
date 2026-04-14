// ── Web Enrichment: Extract product data from web search results via AI ────────
//
// When OFF doesn't have a product, we search the web (via Brave) and use
// Gemini to extract structured product info from search result snippets.

import { SchemaType, type Schema } from "@google/generative-ai";
import { genAI, MODEL } from "./ai";
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
 * Extract structured product data from raw web search text using Gemini.
 */
async function extractProductFromText(
  searchText: string,
  hint: string
): Promise<EnrichedProduct | null> {
  if (!genAI) {
    console.warn("Gemini not available — cannot extract product data");
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
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
      searchText.slice(0, 6000), // cap context to save tokens
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
    return null;
  }
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
  const searchResult = await searchProductByName(name, brand);
  if (!searchResult || searchResult.results.length === 0) return null;

  const product = await extractProductFromText(
    searchResult.raw_text,
    brand ? `${brand} ${name}` : name
  );

  if (product) {
    product.source_urls = searchResult.results.map((r) => r.url);
  }

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
