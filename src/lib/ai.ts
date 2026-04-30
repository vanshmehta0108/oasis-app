import { GoogleGenerativeAI } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

/**
 * Lazily initialize the Gemini client.
 * This ensures the env var is read at runtime (not build time on Vercel).
 */
export function getGenAI(): GoogleGenerativeAI | null {
  if (_client) return _client;
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;
  _client = new GoogleGenerativeAI(apiKey);
  return _client;
}

/** @deprecated Use getGenAI() for lazy init. Kept for backward compat. */
export const genAI = null as GoogleGenerativeAI | null;

// Reasoning / scoring model — better at structured output and the voice
// rules. Used by analyzeIngredients() and translateAnalysis().
export const MODEL = "gemini-2.5-flash";

// Cheaper OCR-only model for the vision pass that extracts ingredient
// strings from a label photo. Roughly ~3-5× cheaper per image at similar
// quality for plain text extraction (no reasoning needed). Override with
// `GEMINI_OCR_MODEL` env var if Google retires the model name.
export const MODEL_OCR = process.env.GEMINI_OCR_MODEL?.trim() || "gemini-2.0-flash";
