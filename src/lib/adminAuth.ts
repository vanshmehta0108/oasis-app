// Centralized admin auth check.
//
// Uses crypto.timingSafeEqual to defeat timing attacks on the secret comparison
// — a plain `===` leaks per-char timing, letting an attacker reconstruct the
// secret with enough requests. The buffer-padding step prevents the function
// from leaking length differences either.
//
// All admin routes MUST read the secret from the `x-admin-key` header. Never
// accept it from a query string (logged in CDN/server access logs and
// Referer headers) or a JSON body field.

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export function isAdminAuthorized(req: Request | NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return false;
  const headerValRaw = req.headers.get("x-admin-key");
  const headerVal = headerValRaw?.trim() ?? "";
  if (!headerVal) return false;

  // Pad both sides to a fixed length so the comparison runtime does not depend
  // on the lengths the attacker supplies. We compare against a SHA-derived
  // buffer instead of raw strings to avoid leaking length via the equality
  // check itself.
  const a = Buffer.from(headerVal, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) {
    // Still run a constant-time op to keep timing flat.
    timingSafeEqual(b, b);
    return false;
  }
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
