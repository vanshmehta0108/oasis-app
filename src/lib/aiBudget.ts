// Daily AI token budget guard.
//
// Why this exists: /api/analyze with an image input is the most cost-leaky
// path in the app. Rate-limit caps requests per IP per minute, but a
// determined attacker rotating through 50 cheap residential proxies can
// still drain the ₹990/month Gemini budget in seconds. This adds a global
// daily ceiling on top of the per-IP rate limit — once N tokens are spent
// in a UTC day, every Gemini call is rejected until tomorrow.
//
// Backends (mirrors rateLimit.ts):
//   - Upstash Redis (preferred, durable, distributed) — INCRBY against a
//     date-keyed counter that auto-expires after 48h.
//   - Process-local counter (fallback) — survives only within one
//     serverless instance, so a determined attacker who spreads across
//     instances can dilute it. Better than nothing; in production with
//     Upstash configured the local counter is a safety net.
//
// Env vars:
//   GEMINI_DAILY_TOKEN_CAP — daily ceiling, default 4_000_000 tokens
//     (~₹450/day at gemini-2.5-flash pricing, leaves margin under
//     ₹990/mo). Set to 0 to disable enforcement.
//   GEMINI_KILL_SWITCH=1   — hard stop. Rejects every request regardless
//     of usage. Flip on if a leak is suspected and you want zero AI spend
//     until the next deploy.

const DEFAULT_CAP = 4_000_000;
const LOCAL_TTL_MS = 26 * 60 * 60 * 1000; // 26h to safely span a UTC day
const SAFETY_MIN_RESERVE = 5_000;          // refuse if remaining < this

interface LocalBucket {
  day: string;
  tokens: number;
  expiresMs: number;
}

let local: LocalBucket | null = null;

function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dailyCap(): number {
  const raw = process.env.GEMINI_DAILY_TOKEN_CAP?.trim();
  if (!raw) return DEFAULT_CAP;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_CAP;
}

function killSwitchActive(): boolean {
  return process.env.GEMINI_KILL_SWITCH?.trim() === "1";
}

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

function localGet(): number {
  if (!local) return 0;
  if (local.day !== utcDay() || Date.now() > local.expiresMs) {
    local = null;
    return 0;
  }
  return local.tokens;
}

function localAdd(n: number) {
  const day = utcDay();
  if (!local || local.day !== day) {
    local = { day, tokens: 0, expiresMs: Date.now() + LOCAL_TTL_MS };
  }
  local.tokens += n;
}

export type BudgetCheck =
  | { ok: true; remaining: number; backend: "upstash" | "local"; usedToday: number }
  | { ok: false; reason: "kill_switch" | "daily_cap_exceeded"; usedToday: number; cap: number };

// Call BEFORE issuing a Gemini request. If `ok:false`, refuse the call.
// `expectedTokens` lets the guard refuse when the request alone would
// blow past the cap (e.g. a 3MB image that'd cost 8000 tokens with only
// 2000 remaining for the day).
export async function checkAiBudget(expectedTokens = SAFETY_MIN_RESERVE): Promise<BudgetCheck> {
  if (killSwitchActive()) {
    return { ok: false, reason: "kill_switch", usedToday: 0, cap: 0 };
  }
  const cap = dailyCap();
  if (cap === 0) return { ok: true, remaining: Number.POSITIVE_INFINITY, backend: "local", usedToday: 0 };

  const cfg = upstashConfigured();
  let used: number;
  let backend: "upstash" | "local" = "local";
  if (cfg) {
    try {
      const k = `aibudget:${utcDay()}`;
      const got = await upstash(cfg, ["GET", k]);
      used = got == null ? 0 : Number(got) || 0;
      backend = "upstash";
    } catch {
      used = localGet();
    }
  } else {
    used = localGet();
  }

  const projected = used + Math.max(expectedTokens, SAFETY_MIN_RESERVE);
  if (projected > cap) {
    return { ok: false, reason: "daily_cap_exceeded", usedToday: used, cap };
  }
  return { ok: true, remaining: cap - used, backend, usedToday: used };
}

// Call AFTER a Gemini request to record usage. Pass the actual usage
// metadata returned by the SDK (totalTokenCount). Failure to record
// (e.g. Upstash hiccup) falls back to local — never throws into the
// caller's hot path.
export async function recordTokenUsage(tokens: number): Promise<void> {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  if (killSwitchActive()) return;
  if (dailyCap() === 0) return;

  localAdd(tokens);

  const cfg = upstashConfigured();
  if (!cfg) return;
  try {
    const k = `aibudget:${utcDay()}`;
    // Atomic INCRBY + EXPIRE in a single pipeline so the key always has a TTL.
    await upstash(cfg, [
      "EVAL",
      `local n = redis.call('INCRBY', KEYS[1], ARGV[1]) if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end return n`,
      1,
      k,
      String(tokens),
      String(Math.ceil(LOCAL_TTL_MS / 1000)),
    ]);
  } catch {
    // already recorded locally — fail open
  }
}

// Lightweight token estimator for logging/sizing when the SDK doesn't
// surface usage metadata (e.g. on errors). Image bytes are counted at
// ~258 tokens per 1024x1024 tile and text at ~4 chars/token.
export function estimateTokens(opts: { textLength?: number; imageBytes?: number }): number {
  const t = Math.ceil((opts.textLength ?? 0) / 4);
  // A typical 1024x1024 image is ~1MB raw → costs ~258 tokens. Approximate
  // linearly against bytes for ballpark estimation.
  const i = Math.ceil((opts.imageBytes ?? 0) / 4096);
  return t + i;
}
