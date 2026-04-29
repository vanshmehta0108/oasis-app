// Swap — turns a Gemini-generated `healthier_alternative` string into a
// "Swap to Instamart" CTA.
//
// The verdict card surfaces this as a one-tap action when the verdict tone
// is skip/avoid AND we have an alternative. This is the partnership pitch
// built into the product: every "we'd skip it" comes with a real path to
// the better thing.

import { buildStaticSearchUrl } from "./swiggy";

const PREFIX_PATTERNS = [
  /^try\s+/i,
  /^swap\s+(?:for\s+|to\s+)?/i,
  /^pick\s+/i,
  /^choose\s+/i,
  /^go\s+for\s+/i,
  /^reach\s+for\s+/i,
  /^consider\s+/i,
];

// Pulls the buyable item out of a healthier_alternative string. Examples:
//   "Try Slurrp Farm Ragi Puffs or Yoga Bar Multigrain Crackers."
//     → "Slurrp Farm Ragi Puffs"
//   "Swap for plain salted peanuts from any kirana."
//     → "plain salted peanuts"
//   "Choose products with whole-food ingredients and lower sugar content."
//     → null  (too abstract — no specific product named)
//
// We deliberately take only the FIRST suggestion. Two-product strings are
// noisy in a small pill button; the user can read the full advice in the
// "A better pick" card below.
export function extractSwapQuery(alt: string | undefined | null): string | null {
  if (!alt) return null;

  let text = alt.trim();
  for (const re of PREFIX_PATTERNS) text = text.replace(re, "");

  // Cut off after the user's actionable noun phrase — drop anything after
  // a period, comma, "from <brand>", or "instead of". We keep "X or Y"
  // intact because Instamart's search handles either, and splitting on
  // " or " would shred "Ragi or Oats biscuits" into "Ragi".
  const firstClause = text.split(/(?:\.|,|\bfrom\b|\binstead of\b)/i)[0]?.trim();
  if (!firstClause) return null;

  // Reject abstract advice ("products with whole-food ingredients").
  if (firstClause.split(/\s+/).length < 2) return null;
  if (/^(?:products?|options?|alternatives?|something|anything|brands?|items?)\s/i.test(firstClause)) return null;

  return firstClause.slice(0, 60);
}

export interface SwapCTA {
  query: string;     // What we're sending the user to find
  url: string;       // Instamart deeplink
  label: string;     // Button text — short, action-shaped
}

// Build a swap CTA from a healthier_alternative string. Returns null if the
// alternative is too abstract to deeplink confidently. The caller should
// then fall back to showing the alternative as descriptive text only.
export function buildSwapCTA(healthierAlternative: string | undefined | null): SwapCTA | null {
  const query = extractSwapQuery(healthierAlternative);
  if (!query) return null;
  return {
    query,
    url: buildStaticSearchUrl(query),
    label: `Find ${query} on Instamart`,
  };
}
