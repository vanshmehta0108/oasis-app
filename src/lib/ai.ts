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

export const MODEL = "gemini-2.5-flash";
