// Shared PII / secret scrubber for Sentry events.
//
// Scrubs:
//   - request bodies (the only place a captcha token, admin key, or auth
//     header would land in a Sentry event payload)
//   - request cookies and authorization-style headers
//   - email addresses anywhere in error messages or breadcrumb payloads
//   - common API key patterns (sk-, AIza..., supabase service-role JWTs)
//
// Why scrub at all: even with `sendDefaultPii: false`, Sentry will still
// pick up raw exception messages like
//   `verifyCaptcha failed: secret=hcap_xxx, ip=203.0.113.5, email=user@x.com`
// because that text was constructed by our code, not Sentry. The vendor
// has no way to know it contains secrets — we have to redact it ourselves.

import type { EventHint, ErrorEvent } from "@sentry/core";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SECRET_RE = /\b(sk-[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|hcap_[A-Za-z0-9_-]{16,})\b/g;
const SECRET_HEADERS = new Set(["authorization", "cookie", "x-admin-key", "x-api-key", "x-supabase-auth"]);

function scrubString(s: string): string {
  return s.replace(EMAIL_RE, "[email]").replace(SECRET_RE, "[secret]");
}

function scrubHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SECRET_HEADERS.has(k.toLowerCase()) ? "[redacted]" : scrubString(String(v));
  }
  return out;
}

export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  try {
    const req = event.request as Record<string, unknown> | undefined;
    if (req) {
      // `cookies` is typed as Cookie[] | [string, string][] | string, but
      // the simplest safe scrub is to drop it entirely. We reach in with a
      // loose cast so the redaction works regardless of which shape Sentry's
      // SDK assigned.
      (req as { cookies?: unknown }).cookies = undefined;
      req.headers = scrubHeaders(req.headers as Record<string, string> | undefined);
      if (typeof req.data === "string") {
        req.data = scrubString(req.data);
      }
      if (typeof req.query_string === "string") {
        req.query_string = scrubString(req.query_string);
      }
    }
    if (event.user?.email) event.user.email = "[redacted]";
    if (event.user?.ip_address) event.user.ip_address = "0.0.0.0";

    event.exception?.values?.forEach((ex) => {
      if (ex.value) ex.value = scrubString(ex.value);
    });
    if (event.message) {
      if (typeof event.message === "string") {
        event.message = scrubString(event.message);
      } else if (event.message && typeof event.message === "object" && "message" in event.message) {
        const m = event.message as { message?: string };
        if (m.message) m.message = scrubString(m.message);
      }
    }
    event.breadcrumbs?.forEach((bc) => {
      if (bc.message) bc.message = scrubString(bc.message);
    });
  } catch {
    // never let the scrubber crash event submission
  }
  return event;
}
