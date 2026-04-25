"use client";

import { supabase } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

// ── Session bootstrap ─────────────────────────────────────────────────────

// Ensures every visitor has a session. If none exists, creates an anonymous
// one so scans, profile, and history can be persisted against a stable
// user_id even before the user signs in. Returns the current user or null
// if anonymous auth isn't enabled in the Supabase project (fails gracefully
// — the app falls back to localStorage-only mode).
export async function ensureSession(): Promise<User | null> {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) return existing.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    // "Anonymous sign-ins disabled" is the common case before the project
    // has been configured. Log once, don't crash.
    console.warn("Anonymous auth unavailable:", error.message);
    return null;
  }
  return data.user;
}

// ── Google sign-in ────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
  const redirectTo = typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(window.location.pathname)}`
    : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Email / password auth ─────────────────────────────────────────────────

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string; needsConfirmation?: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, needsConfirmation: !data.session };
}

export async function resetPassword(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── Sign out ──────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  // After signout, immediately bootstrap a new anonymous session so the
  // user can keep using the app without cross-device sync.
  await ensureSession();
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function isAnonymous(user: User | null): boolean {
  // Supabase marks anonymous users with is_anonymous: true. Fallback to
  // checking for absence of email/phone for older SDKs.
  if (!user) return true;
  if ((user as unknown as { is_anonymous?: boolean }).is_anonymous) return true;
  return !user.email && !user.phone;
}

export function displayNameFor(user: User | null): string {
  if (!user) return "Guest";
  const meta = user.user_metadata ?? {};
  return (meta.full_name as string) || (meta.name as string) || user.email || "You";
}

export type { Session, User };
