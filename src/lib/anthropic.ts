import Anthropic from "@anthropic-ai/sdk";

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Return a placeholder client during build — API calls will fail at runtime with a clear error
    return new Anthropic({ apiKey: "placeholder-for-build" });
  }
  return new Anthropic({ apiKey });
}

export const anthropic = getAnthropicClient();
export const MODEL = "claude-sonnet-4-20250514";
