// Image-hash dedup cache for /api/analyze.
//
// Why: same label photo gets resubmitted constantly — the user retries on
// a flaky network, two tabs analyze the same product, the recategorize
// pipeline reprocesses an image. Without dedup, every call hits Gemini
// vision (~2000 tokens, ~₹0.30) for a result we already have. The cache
// stores the LabelExtraction keyed by SHA-256 of the raw image bytes, so
// identical photos return instantly without an AI call.
//
// Backend: Upstash Redis with a 7-day TTL when configured, otherwise an
// in-memory LRU that survives only within one serverless instance. The
// in-memory LRU is still useful for retries within a single user session
// (most cache hits land within seconds of the original call).
//
// Deliberately NOT cached: nutrition-panel mistakes. We hash the image
// bytes, but if the previous extraction returned a nutrition panel (which
// the route rejects with a clear error), we don't want to keep returning
// the same wrong extraction — so the route only writes successful
// extractions to the cache.

import { createHash } from "node:crypto";

interface LRUEntry<T> {
  value: T;
  insertedAtMs: number;
}

const LRU_MAX = 256;
const LRU_TTL_MS = 30 * 60 * 1000;
const REMOTE_TTL_SEC = 7 * 24 * 3600;

function upstashConfigured(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

async function upstash(cfg: { url: string; token: string }, cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`upstash_${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

// ── In-memory LRU ────────────────────────────────────────────────────────
const lru = new Map<string, LRUEntry<string>>();

function lruGet(key: string): string | null {
  const e = lru.get(key);
  if (!e) return null;
  if (Date.now() - e.insertedAtMs > LRU_TTL_MS) {
    lru.delete(key);
    return null;
  }
  // Touch — re-insert to make it most-recent.
  lru.delete(key);
  lru.set(key, e);
  return e.value;
}

function lruSet(key: string, value: string): void {
  if (lru.size >= LRU_MAX) {
    const oldest = lru.keys().next().value;
    if (oldest !== undefined) lru.delete(oldest);
  }
  lru.set(key, { value, insertedAtMs: Date.now() });
}

// ── Public API ───────────────────────────────────────────────────────────

// Compute a stable SHA-256 of the raw image bytes (after stripping the
// data URL prefix). Same image → same hash regardless of mimetype prefix.
export function hashImage(base64Image: string): string {
  const stripped = base64Image.replace(/^data:image\/[a-z+]+;base64,/i, "");
  return createHash("sha256").update(stripped).digest("hex");
}

// Returns the cached payload (already JSON-stringified) or null. Callers
// JSON.parse the result themselves so the cache stays type-agnostic.
export async function getCachedLabel(hash: string): Promise<string | null> {
  // Try local first — sub-millisecond.
  const localHit = lruGet(hash);
  if (localHit) return localHit;

  const cfg = upstashConfigured();
  if (!cfg) return null;
  try {
    const got = await upstash(cfg, ["GET", `imghash:${hash}`]);
    if (typeof got !== "string") return null;
    lruSet(hash, got); // populate local for future hits in this instance
    return got;
  } catch {
    return null;
  }
}

export async function setCachedLabel(hash: string, payload: string): Promise<void> {
  lruSet(hash, payload);
  const cfg = upstashConfigured();
  if (!cfg) return;
  try {
    await upstash(cfg, ["SET", `imghash:${hash}`, payload, "EX", String(REMOTE_TTL_SEC)]);
  } catch {
    // already in local LRU — fail open
  }
}
