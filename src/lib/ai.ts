import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    // Return null during build — API calls will fail at runtime with a clear error
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

export const genAI = getGeminiClient();
export const MODEL = "gemini-2.5-flash";
