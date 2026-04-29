// Verdict — turns the analysis JSON into a human, opinionated decision.
//
// The summary string from Gemini describes the product. The verdict tells
// the user what to *do* with it. That difference is the entire premium
// feel: a friend at the supermarket, not a database.
//
// Inputs are intentionally minimal so this works for both DB-loaded and
// freshly-analysed products without coupling to either shape.

import { t, type Language } from "./i18n";

export type VerdictTone = "clean" | "mostly" | "occasional" | "skip" | "avoid";

export interface Verdict {
  tone: VerdictTone;
  headline: string;       // The decision. 2–4 words. "We'd buy it." / "Put it back."
  subhead: string;        // One sentence of *why*. Plain English.
  accent: string;         // Hex — used for borders, halos, the verdict pill
  bg: string;             // Hex — soft background for the card
  emoji?: string;         // Optional. Used sparingly.
}

interface VerdictInput {
  score: number | null;
  harmfulCount?: number;
  beneficialCount?: number;
  warningsCount?: number;
  summary?: string;
  language?: Language;
  // Wave 2 — optional personalization context. When the user has set their
  // health profile, the verdict can sharpen ("worth a closer look" → "we'd
  // skip this for you"). When absent, behavior is identical to wave 1.
  userContext?: {
    conditions?: string[];   // e.g. ["Diabetic", "Heart Condition"]
    allergies?: string[];    // e.g. ["Nuts", "Dairy"]
    seriousWarnings?: number; // count of "serious" PersonalWarnings the API returned
  };
  // Wave 2 — when a healthier alternative is available we can reshape the
  // subhead to nudge toward the swap rather than just describing the problem.
  hasAlternative?: boolean;
}

// Color tokens — kept here (not in CSS) because they're verdict-specific
// and we don't want them re-used as generic surface colors. The greens
// and reds are warmer than the iOS system colors, which makes the verdict
// cards feel editorial rather than systemic.
const TONE_COLORS: Record<VerdictTone, { accent: string; bg: string }> = {
  clean:      { accent: "#00875A", bg: "#E8F7F0" },
  mostly:     { accent: "#1E8040", bg: "#F0FBF4" },
  occasional: { accent: "#B87800", bg: "#FFF8E6" },
  skip:       { accent: "#CC5200", bg: "#FFF2E8" },
  avoid:      { accent: "#CC1010", bg: "#FFF0EE" },
};

export function toneFromScore(score: number | null): VerdictTone {
  if (score == null) return "occasional";
  if (score >= 85) return "clean";
  if (score >= 70) return "mostly";
  if (score >= 50) return "occasional";
  if (score >= 30) return "skip";
  return "avoid";
}

// Picks the right verdict copy based on tone + signal density. The
// subhead nudges sharper when the analysis surfaces specific counts.
export function buildVerdict(input: VerdictInput): Verdict {
  const lang = input.language ?? "en";
  // Personalization may bump tone — a "mostly fine" cereal becomes "skip"
  // for a diabetic if it's loaded with sugar. We only bump *down* (more
  // cautious), never up.
  const baseTone = toneFromScore(input.score);
  const tone = adjustForUser(baseTone, input);
  const colors = TONE_COLORS[tone];

  const headline = (() => {
    switch (tone) {
      case "clean":      return t("verdict_clean", lang);
      case "mostly":     return t("verdict_mostly", lang);
      case "occasional": return t("verdict_occasional", lang);
      case "skip":       return t("verdict_skip", lang);
      case "avoid":      return t("verdict_avoid", lang);
    }
  })();

  const subhead = pickSubhead(tone, input, lang);

  return {
    tone,
    headline,
    subhead,
    accent: colors.accent,
    bg: colors.bg,
  };
}

// Bumps the verdict toward more caution when the user has signalled health
// context that intersects with the product's flagged ingredients. This is
// the "this app knows me" moment — the verdict reads differently for a
// diabetic looking at a sugary cereal than it does for everyone else.
function adjustForUser(base: VerdictTone, input: VerdictInput): VerdictTone {
  const ctx = input.userContext;
  if (!ctx) return base;
  const conditions = ctx.conditions?.length ?? 0;
  const allergies = ctx.allergies?.length ?? 0;
  const serious = ctx.seriousWarnings ?? 0;
  if (conditions === 0 && allergies === 0) return base;

  const order: VerdictTone[] = ["clean", "mostly", "occasional", "skip", "avoid"];
  const idx = order.indexOf(base);

  // Two or more serious personal warnings → push at least to "skip".
  if (serious >= 2 && idx < order.indexOf("skip")) return "skip";
  // One serious warning → bump one notch down (more cautious).
  if (serious >= 1 && idx < order.indexOf("avoid")) return order[idx + 1];

  return base;
}

function pickSubhead(tone: VerdictTone, input: VerdictInput, lang: Language): string {
  const harmful = input.harmfulCount ?? 0;
  const beneficial = input.beneficialCount ?? 0;

  // English gets nuanced subheads built from counts; Hindi falls back to
  // the bundled translation since the count-based variants don't read
  // naturally in Hinglish without a separate copy pass.
  if (lang === "hi") {
    switch (tone) {
      case "clean":      return t("verdict_clean_sub", lang);
      case "mostly":     return t("verdict_mostly_sub", lang);
      case "occasional": return t("verdict_occasional_sub", lang);
      case "skip":       return t("verdict_skip_sub", lang);
      case "avoid":      return t("verdict_avoid_sub", lang);
    }
  }

  const altSuffix = input.hasAlternative ? " There's a better pick below." : "";
  const personal = input.userContext;
  const seriousPersonal = (personal?.seriousWarnings ?? 0) >= 1;

  // English — count-aware, sharper. When the user has serious personal
  // warnings, the subhead becomes second-person — "for you specifically".
  switch (tone) {
    case "clean":
      if (beneficial >= 3) return `Clean ingredients — ${beneficial} we'd actively recommend.`;
      return "Clean ingredients. No real concerns.";
    case "mostly":
      if (seriousPersonal) return `Generally fine — but one ingredient hits your profile.${altSuffix}`;
      if (harmful === 1)   return `One ingredient is worth a closer look — otherwise fine.${altSuffix}`;
      if (harmful >= 2)    return `${harmful} ingredients are worth a closer look — otherwise fine.${altSuffix}`;
      return "Mostly fine. No red flags.";
    case "occasional":
      if (seriousPersonal) return `Not for your health profile — we'd skip it.${altSuffix}`;
      if (harmful >= 3)    return `${harmful} ingredients we'd watch. Fine occasionally, not daily.${altSuffix}`;
      return `Not your daily — fine for a treat.${altSuffix}`;
    case "skip":
      if (seriousPersonal) return `We'd skip it for you — multiple things on your no-go list.${altSuffix || " Better picks below."}`;
      if (harmful >= 3)    return `${harmful} ingredients we'd rather not eat.${altSuffix || " Better picks below."}`;
      return `Several ingredients we'd rather not eat.${altSuffix || " Better picks below."}`;
    case "avoid":
      if (seriousPersonal) return "This one's not for you — full stop.";
      if (harmful >= 4)    return `${harmful} flagged ingredients. We'd put it back.`;
      return "Full of stuff we'd skip. We'd put it back.";
  }
}

// Compute a personalized score for the *displayed* score. Never raises the
// score, only lowers it. When the user has no personalization or when the
// penalty is 0, returns the original score unchanged.
//
// Kept here (not in allergens.ts) because it's the UI-facing piece — the
// matcher decides the penalty; this function decides what the user sees.
export function personalizedScore(baseScore: number | null, penalty: number): number | null {
  if (baseScore == null) return null;
  if (!Number.isFinite(penalty) || penalty <= 0) return baseScore;
  return Math.max(0, Math.min(100, Math.round(baseScore - penalty)));
}

// Convenience: tone label suitable for a small badge.
export function toneBadge(tone: VerdictTone, lang: Language = "en"): string {
  switch (tone) {
    case "clean":      return t("safe", lang);
    case "mostly":     return t("safe", lang);
    case "occasional": return t("caution", lang);
    case "skip":       return t("warning", lang);
    case "avoid":      return t("danger", lang);
  }
}
