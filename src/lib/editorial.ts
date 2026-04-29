// Editorial — a hand-curated content layer that runs alongside the algorithmic
// home feed. Each "issue" is a magazine-style card surfaced on home that drives
// the user into a search/category and signals taste.
//
// Adding new content is a single JSON entry — no DB migration, no deploy
// pipeline, no CMS. The expectation is one new issue per week, queued ahead
// of time. Loading is synchronous and cache-friendly.

import editorialData from "@/data/editorial.json";
import type { VerdictTone } from "./verdict";

export interface EditorialIssue {
  id: string;
  publishedAt: string;       // ISO date — used to pick the latest
  kicker: string;            // small uppercase eyebrow ("Kids' snacks")
  headline: string;          // bold headline ("5 popular kids' snacks we'd put back")
  subhead: string;           // one-sentence body
  tone: VerdictTone;         // colour the card with the same palette as a verdict
  cta: string;               // button text ("See the list")
  href: string;              // where the CTA goes
  tag: string;               // category label ("What we're flagging")
}

// Returns the most recently published editorial issue, or null if none
// exist. Sorted by publishedAt descending so future-dated entries do
// surface as soon as their publishedAt passes — but only relative to the
// current device clock (sufficient for an editorial layer).
export function getCurrentIssue(now: Date = new Date()): EditorialIssue | null {
  const issues = (editorialData.issues ?? []) as EditorialIssue[];
  const live = issues.filter((i) => new Date(i.publishedAt) <= now);
  if (live.length === 0) return null;
  live.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return live[0];
}

export function getAllIssues(): EditorialIssue[] {
  return (editorialData.issues ?? []) as EditorialIssue[];
}
