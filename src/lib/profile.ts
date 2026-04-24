"use client";

import { supabase } from "./supabase";

// User profile — stored both in localStorage (for offline + anonymous
// users) and in the user_profiles table (when the user is signed in).
//
// Write-through: saveProfile updates both layers. On sign-in, the
// localStorage copy is the source of truth for the initial migration
// (pushToCloud). After that, remote is authoritative, and any fetch
// from cloud overwrites local.

export interface UserProfile {
  conditions: string[];
  allergies: string[];
  language: "English" | "Hindi";
}

const PROFILE_KEY = "oasis-profile";

const DEFAULT_PROFILE: UserProfile = { conditions: [], allergies: [], language: "English" };

function readLocal(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      conditions: Array.isArray(parsed.conditions) ? parsed.conditions.filter((c): c is string => typeof c === "string") : [],
      allergies: Array.isArray(parsed.allergies) ? parsed.allergies.filter((a): a is string => typeof a === "string") : [],
      language: parsed.language === "Hindi" ? "Hindi" : "English",
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function writeLocal(p: UserProfile): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}

// Synchronous read for callers that can't wait — always hits localStorage.
// Cloud data is eventually mirrored here so the values converge.
export function loadProfile(): UserProfile {
  return readLocal();
}

export function hasPersonalization(p: UserProfile): boolean {
  return p.conditions.length > 0 || p.allergies.length > 0;
}

export function saveProfile(p: UserProfile): void {
  writeLocal(p);
  // Fire-and-forget cloud sync. Failures are non-fatal — local is
  // source-of-truth when offline / signed-out.
  void pushToCloud(p);
}

// ── Cloud sync ───────────────────────────────────────────────────────────

async function pushToCloud(p: UserProfile): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("user_profiles")
      // @ts-expect-error Supabase upsert typing mismatch
      .upsert(
        {
          user_id: user.id,
          display_name: user.user_metadata?.full_name || user.email || "You",
          health_conditions: p.conditions,
          allergies: p.allergies,
          language_preference: p.language,
        },
        { onConflict: "user_id" },
      );
  } catch {
    // Silent — the local copy is correct, cloud will sync on next change.
  }
}

// Pull the user's profile from the cloud. Returns null if not signed in
// or no row exists yet. Caller should fall back to local.
export async function fetchFromCloud(): Promise<UserProfile | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("user_profiles")
      .select("health_conditions, allergies, language_preference")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) return null;
    const row = data as { health_conditions?: string[]; allergies?: string[]; language_preference?: string };
    return {
      conditions: row.health_conditions ?? [],
      allergies: row.allergies ?? [],
      language: row.language_preference === "Hindi" ? "Hindi" : "English",
    };
  } catch {
    return null;
  }
}

// Called once on sign-in: merge localStorage with remote. Remote wins on
// conflicts (otherwise new devices would overwrite server data). Arrays
// are unioned so the user's accumulated conditions/allergies survive.
export async function hydrateOnSignIn(): Promise<UserProfile> {
  const local = readLocal();
  const cloud = await fetchFromCloud();

  if (!cloud) {
    // First time on this account — push local state up.
    await pushToCloud(local);
    return local;
  }

  const merged: UserProfile = {
    conditions: Array.from(new Set([...cloud.conditions, ...local.conditions])),
    allergies: Array.from(new Set([...cloud.allergies, ...local.allergies])),
    language: cloud.language, // server preference wins
  };
  writeLocal(merged);
  if (merged.conditions.length !== cloud.conditions.length || merged.allergies.length !== cloud.allergies.length) {
    await pushToCloud(merged);
  }
  return merged;
}
