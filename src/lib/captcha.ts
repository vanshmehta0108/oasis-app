// hCaptcha verification.
//
// Activates when HCAPTCHA_SECRET is set. Without it, the verifier is a
// no-op pass-through — useful in dev and during the closed-beta phase
// before a real key is provisioned.
//
// Setup:
//   1. Sign up at https://www.hcaptcha.com (free tier covers our scale).
//   2. Get the Sitekey + Secret. Add HCAPTCHA_SITEKEY (NEXT_PUBLIC_HCAPTCHA_SITEKEY)
//      and HCAPTCHA_SECRET to Vercel env.
//   3. Render <HCaptcha sitekey={...} /> on the form (frontend) and POST
//      the resulting token alongside the form body.
//   4. The route extracts the token and calls verifyCaptcha() before
//      processing the submission.

const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

export interface CaptchaContext {
  ip?: string;
}

export type CaptchaResult =
  | { ok: true; mode: "verified" | "skipped" }
  | { ok: false; reason: string };

// Behavior:
//  - Dev / preview / non-production: returns ok:true with mode:"skipped" if
//    no secret is configured, so the closed beta keeps working without keys.
//  - Production (NODE_ENV === "production"): a missing secret fails CLOSED.
//    A silently-passing captcha in prod would mean any deploy that forgets
//    to set HCAPTCHA_SECRET ships an open spam endpoint — caught by Swiggy
//    in their security review and weaponized by bots before that.
export async function verifyCaptcha(
  token: string | null | undefined,
  ctx: CaptchaContext = {},
): Promise<CaptchaResult> {
  const secret = process.env.HCAPTCHA_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "captcha_not_configured" };
    }
    return { ok: true, mode: "skipped" };
  }
  if (!token || token.length < 10) {
    return { ok: false, reason: "missing_token" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ctx.ip) body.set("remoteip", ctx.ip);

    const res = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      // 3s ceiling — captcha vendors are usually <500ms; on a stall we
      // fail closed (rate limiter still protects us).
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { ok: false, reason: `verify_status_${res.status}` };
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true, mode: "verified" };
    return { ok: false, reason: data["error-codes"]?.join(",") ?? "unknown" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "verify_failed" };
  }
}

export function captchaConfigured(): boolean {
  return !!process.env.HCAPTCHA_SECRET?.trim();
}
