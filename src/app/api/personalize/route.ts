export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPersonalizedAnalysis } from "@/lib/scoring";
import { dedupeProfile, profileHash } from "@/lib/allergens";
import { log } from "@/lib/log";
import { checkRateLimit } from "@/lib/rateLimit";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";

const PersonalizeRequest = z.object({
  ingredients: z.array(z.string().min(1)).min(1, "Ingredients required").max(200),
  conditions: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
});

const corsOpts = { methods: ["POST", "OPTIONS"] as const };
const corsHeaders = (req: NextRequest) => corsHeadersFor(req, corsOpts);

// ── In-memory cache ───────────────────────────────────────────────────────
// LRU keyed on (ingredients-hash :: profile-hash). Sized small — Vercel
// serverless instances are short-lived, so this is just a per-instance
// short-term shield against repeat scrolling/re-renders hitting the LLM.
// A user re-visiting the same product within an instance lifetime gets
// instant results.

const CACHE_MAX = 200;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  expiresAt: number;
  payload: Awaited<ReturnType<typeof getPersonalizedAnalysis>>;
}

const cache = new Map<string, CacheEntry>();

function ingredientsHash(ingredients: readonly string[]): string {
  // Order-preserving: same ingredient list in same order = same key.
  // We keep the original order because the LLM's `triggering_ingredient`
  // citation can vary subtly with order; not worth invalidating cache for.
  return ingredients.map((s) => s.trim().toLowerCase()).join("|");
}

function cacheKey(ingredients: readonly string[], conditions: readonly string[], allergies: readonly string[]): string {
  return `${ingredientsHash(ingredients)}::${profileHash(conditions, allergies)}`;
}

function getCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  // LRU touch.
  cache.delete(key);
  cache.set(key, entry);
  return entry.payload;
}

function setCached(key: string, payload: CacheEntry["payload"]): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
}

// ── Handlers ──────────────────────────────────────────────────────────────

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return corsPreflight(req, corsOpts);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cors = corsHeaders(req);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`personalize:${ip}`, { capacity: 20, refillPerMin: 20 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limit", retryAfter: rl.retryAfter },
      { status: 429, headers: { ...cors, "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    // Cap body size before parsing — defends against giant JSON payloads.
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > 64 * 1024) {
      return NextResponse.json(
        { error: "payload_too_large" },
        { status: 413, headers: cors },
      );
    }
    const body = await req.json();
    const parsed = PersonalizeRequest.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.issues[0]?.message },
        { status: 400, headers: cors },
      );
    }

    // Normalize and dedupe profile inputs server-side. Defends against
    // older clients that don't validate locally yet.
    const ingredients = parsed.data.ingredients;
    const conditions = dedupeProfile(parsed.data.conditions);
    const allergies = dedupeProfile(parsed.data.allergies);

    if (conditions.length === 0 && allergies.length === 0) {
      return NextResponse.json(
        { warnings: [], penalty: 0, deterministicCount: 0, llmCount: 0, llmCalled: false, cached: false },
        { headers: cors },
      );
    }

    const key = cacheKey(ingredients, conditions, allergies);
    const cached = getCached(key);
    if (cached) {
      log.info("personalize.cache_hit", {
        ingredientCount: ingredients.length,
        warningCount: cached.warnings.length,
      });
      return NextResponse.json(
        { ...cached, cached: true },
        { headers: cors },
      );
    }

    const result = await getPersonalizedAnalysis(ingredients, conditions, allergies);
    setCached(key, result);

    log.info("personalize.ok", {
      ingredientCount: ingredients.length,
      conditionCount: conditions.length,
      allergyCount: allergies.length,
      warningCount: result.warnings.length,
      deterministicCount: result.deterministicCount,
      llmCount: result.llmCount,
      llmCalled: result.llmCalled,
      penalty: result.penalty,
      llmError: result.llmError,
    });

    return NextResponse.json({ ...result, cached: false }, { headers: cors });
  } catch (err) {
    log.error("personalize.fail", { err: err instanceof Error ? err.message : String(err) });
    const message = err instanceof Error ? err.message : "Personalization failed";
    const isRateLimit = /rate|quota|429|resource_exhausted/i.test(message);
    return NextResponse.json(
      { error: isRateLimit ? "ai_unavailable" : "personalize_failed" },
      { status: isRateLimit ? 429 : 500, headers: cors },
    );
  }
}
