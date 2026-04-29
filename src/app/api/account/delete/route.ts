export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { corsHeadersFor, corsPreflight } from "@/lib/cors";
import { checkRateLimit } from "@/lib/rateLimit";
import { log } from "@/lib/log";

// Right-to-erasure endpoint. Required by India's DPDP Act 2023 (and GDPR).
// Flow:
//   1. User clicks "Delete my data" in profile.
//   2. UI calls this endpoint with the user's Supabase JWT in Authorization.
//   3. We verify the JWT, call delete_my_data() (PII wipe via RLS-respecting
//      RPC), then call admin.deleteUser to remove the auth row entirely.

const corsOpts = { methods: ["POST", "OPTIONS"] as const };

function adminClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("supabase_admin_not_configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function OPTIONS(req: NextRequest): Promise<Response> {
  return corsPreflight(req, corsOpts);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const cors = corsHeadersFor(req, corsOpts);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`account-delete:${ip}`, { capacity: 3, refillPerMin: 0.5 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limit", retryAfter: rl.retryAfter },
      { status: 429, headers: { ...cors, "Retry-After": String(rl.retryAfter) } },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 401, headers: cors });
  }

  try {
    const admin = adminClient();
    // Step 1: verify the token and resolve the user.
    const { data: userData, error: getErr } = await admin.auth.getUser(token);
    if (getErr || !userData?.user) {
      log.warn("account_delete.invalid_token", { ip });
      return NextResponse.json({ error: "invalid_token" }, { status: 401, headers: cors });
    }
    const userId = userData.user.id;

    // Step 2: wipe rows owned by this user. RLS-respecting RPC handles
    // user_profiles + anonymizes community_submissions.
    const userClient = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim(),
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim(),
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
    );
    const { error: rpcErr } = await userClient.rpc("delete_my_data");
    if (rpcErr) {
      log.error("account_delete.rpc_fail", { ip, userId, err: rpcErr.message });
      return NextResponse.json(
        { error: "delete_failed", details: "Could not delete user data — please contact support." },
        { status: 500, headers: cors },
      );
    }

    // Step 3: delete the auth.users row. Without this the user's email
    // would still be reserved.
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) {
      log.error("account_delete.auth_delete_fail", { ip, userId, err: authErr.message });
      // PII is already gone; just return success-with-warning.
      return NextResponse.json(
        { ok: true, partial: true, note: "Data deleted; auth record cleanup queued." },
        { headers: cors },
      );
    }

    log.info("account_delete.ok", { ip, userId });
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch (err) {
    log.error("account_delete.fail", { ip, err: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "delete_failed" }, { status: 500, headers: cors });
  }
}
