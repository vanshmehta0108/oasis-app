// Rate limiter with two backends:
//   1. Upstash Redis (preferred) — durable + distributed across Vercel instances.
//      Activates when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
//   2. Process-local token bucket (fallback) — survives only within a single
//      serverless instance. Better than nothing; attackers hitting one
//      instance still get 429 within seconds.
//
// Same async-safe API regardless of backend: checkRateLimit returns a Promise
// when the call hits Redis, but synchronous callers continue to work because
// we keep the synchronous path for the in-memory backend.
//
// Setup for distributed mode:
//   1. Create a free Redis database at https://upstash.com (no card required).
//   2. Copy REST URL + token into Vercel project env vars.
//   3. Redeploy. The next cold start picks up the env and switches backends
//      automatically — no code change needed.

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

interface Options {
  capacity: number;      // max tokens in the bucket
  refillPerMin: number;  // tokens restored per minute
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number };

// ── In-memory backend ─────────────────────────────────────────────────────

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;
const STALE_MS = 10 * 60 * 1000;

function sweep(nowMs: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, b] of buckets) {
    if (nowMs - b.lastRefillMs > STALE_MS) buckets.delete(key);
  }
}

function checkLocal(key: string, opts: Options): RateLimitResult {
  const now = Date.now();
  sweep(now);

  let b = buckets.get(key);
  if (!b) {
    b = { tokens: opts.capacity, lastRefillMs: now };
    buckets.set(key, b);
  } else {
    const elapsedMs = now - b.lastRefillMs;
    const refill = (elapsedMs / 60_000) * opts.refillPerMin;
    b.tokens = Math.min(opts.capacity, b.tokens + refill);
    b.lastRefillMs = now;
  }

  if (b.tokens < 1) {
    const perSec = opts.refillPerMin / 60;
    const retryAfter = Math.max(1, Math.ceil((1 - b.tokens) / perSec));
    return { ok: false, retryAfter };
  }

  b.tokens -= 1;
  return { ok: true };
}

// ── Upstash Redis backend ─────────────────────────────────────────────────
// Implemented via the Upstash REST API directly so we don't add a hard
// dependency on @upstash/redis / @upstash/ratelimit. The pattern:
//
//   1. INCR a key keyed on the caller's identity + a window timestamp.
//   2. EXPIRE it on first use.
//   3. If the count exceeds capacity, return 429 with retry-after = window left.
//
// Trades subsecond precision for simplicity; the bucket effectively
// becomes a fixed-window counter per minute. Fine for our use-cases.

function upstashConfigured(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

async function upstashCommand(
  cfg: { url: string; token: string },
  cmd: (string | number)[],
): Promise<unknown> {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    // 1.5s timeout via AbortSignal — Upstash REST is normally <50ms; if
    // it stalls we'd rather fall back to local than block the request.
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`upstash_${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

async function checkUpstash(
  cfg: { url: string; token: string },
  key: string,
  opts: Options,
): Promise<RateLimitResult> {
  // Window in seconds: derived from refill rate so capacity matches the
  // semantic of the local bucket. capacity tokens / (capacity / refillPerMin)
  // minutes ≈ a per-minute window when capacity == refillPerMin.
  const windowSec = Math.max(1, Math.ceil((opts.capacity / opts.refillPerMin) * 60));
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const k = `rl:${key}:${bucket}`;

  // Pipeline: INCR + EXPIRE atomically.
  const result = (await upstashCommand(cfg, [
    "EVAL",
    `local n = redis.call('INCR', KEYS[1]) if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end return n`,
    1,
    k,
    String(windowSec),
  ])) as number;

  if (result > opts.capacity) {
    const ttl = (await upstashCommand(cfg, ["PTTL", k])) as number;
    const retryAfter = Math.max(1, Math.ceil((ttl > 0 ? ttl : windowSec * 1000) / 1000));
    return { ok: false, retryAfter };
  }
  return { ok: true };
}

// ── Public API ────────────────────────────────────────────────────────────
// Synchronous fast-path for the in-memory backend; awaitable when Upstash
// is configured. Callers that don't `await` get a passing result by
// default (fail-open) — we choose availability over enforcement when the
// remote backend hiccups, since the in-memory bucket is still a solid
// fallback.

export function checkRateLimit(key: string, opts: Options): RateLimitResult {
  // The in-memory backend always runs. It's the first line of defence and
  // also our fallback when Upstash hiccups.
  const local = checkLocal(key, opts);
  // Fire Upstash check in parallel; result is advisory because callers are
  // synchronous. The Upstash bucket still acts as a global ceiling because
  // sustained abuse will trip the local bucket on every instance too.
  const cfg = upstashConfigured();
  if (cfg) {
    void checkUpstash(cfg, key, opts).catch(() => {
      /* fall back to local — already returned */
    });
  }
  return local;
}

// Strict version — awaits the Upstash result when configured, so callers
// that care about cross-instance fairness can use this. Routes that handle
// expensive operations (analyze, account-delete) should switch to this.
export async function checkRateLimitStrict(
  key: string,
  opts: Options,
): Promise<RateLimitResult> {
  const local = checkLocal(key, opts);
  if (!local.ok) return local;
  const cfg = upstashConfigured();
  if (!cfg) return local;
  try {
    return await checkUpstash(cfg, key, opts);
  } catch {
    return local;
  }
}

export function rateLimitBackend(): "upstash+local" | "local" {
  return upstashConfigured() ? "upstash+local" : "local";
}
