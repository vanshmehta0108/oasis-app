// Token-bucket rate limiter, process-local.
//
// This is the bare minimum protection against accidental runaway cost
// (an over-eager client retry loop, a simple abuse attempt). On Vercel
// each serverless instance has its own bucket, so real cross-instance
// fairness still requires Upstash/Redis. But a bucket per instance is
// dramatically better than nothing — typical attacker hitting one
// instance sees 429 within seconds.

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

interface Options {
  capacity: number;      // max tokens in the bucket
  refillPerMin: number;  // tokens restored per minute
}

const buckets = new Map<string, Bucket>();

// Evict stale buckets so the Map doesn't grow forever. Cheap — runs at
// most once per call, only when the bucket count exceeds a threshold.
const MAX_BUCKETS = 5000;
const STALE_MS = 10 * 60 * 1000;

function sweep(nowMs: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, b] of buckets) {
    if (nowMs - b.lastRefillMs > STALE_MS) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  { capacity, refillPerMin }: Options,
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  sweep(now);

  let b = buckets.get(key);
  if (!b) {
    b = { tokens: capacity, lastRefillMs: now };
    buckets.set(key, b);
  } else {
    const elapsedMs = now - b.lastRefillMs;
    const refill = (elapsedMs / 60_000) * refillPerMin;
    b.tokens = Math.min(capacity, b.tokens + refill);
    b.lastRefillMs = now;
  }

  if (b.tokens < 1) {
    // Seconds until at least one token is restored
    const perSec = refillPerMin / 60;
    const retryAfter = Math.max(1, Math.ceil((1 - b.tokens) / perSec));
    return { ok: false, retryAfter };
  }

  b.tokens -= 1;
  return { ok: true };
}
