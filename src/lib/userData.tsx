"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useUser } from "./useUser";
import type { IngredientAnalysis } from "./mockData";

// ── Data shapes ───────────────────────────────────────────────────────────

export interface UserProfile {
  conditions: string[];
  allergies: string[];
  language: "English" | "Hindi";
}

export interface ScanRecord {
  id: string;
  name: string;
  brand: string;
  score: number | null;
  grade: string | null;
  category: string;
  timestamp: number;
}

export interface CompareItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  safety_score: number | null;
  grade: string | null;
  summary?: string;
  addedAt: number;
}

export interface BookmarkItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  safety_score: number | null;
  grade: string | null;
  addedAt: number;
}

export interface UserData {
  profile: UserProfile;
  scanHistory: ScanRecord[];
  scanCount: number;
  compareList: CompareItem[];
  bookmarks: BookmarkItem[];
  recentSearches: string[];
  onboarded: boolean;
}

// Fallback used while data loads or when the user isn't authenticated yet.
// Components should render loading states when ready === false rather than
// using these values directly, but having defaults means reads never crash.
const EMPTY: UserData = {
  profile: { conditions: [], allergies: [], language: "English" },
  scanHistory: [],
  scanCount: 0,
  compareList: [],
  bookmarks: [],
  recentSearches: [],
  onboarded: false,
};

const HISTORY_MAX = 50;
const RECENT_MAX = 6;
const COMPARE_MAX = 3;
const BOOKMARK_MAX = 50;

// ── Row <-> UserData mapping ──────────────────────────────────────────────

// user_profiles row is typed loosely because the Supabase generated types
// don't represent the new JSONB columns precisely. Validate at the edges.
type Row = {
  health_conditions?: string[] | null;
  allergies?: string[] | null;
  language_preference?: string | null;
  onboarded?: boolean | null;
  scan_history?: unknown;
  scan_count?: number | null;
  recent_searches?: string[] | null;
  compare_list?: unknown;
  bookmarks?: unknown;
};

function parseScanHistory(raw: unknown): ScanRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is ScanRecord => (
    !!r && typeof r === "object" &&
    typeof (r as ScanRecord).id === "string" &&
    typeof (r as ScanRecord).name === "string"
  ));
}

function parseCompareList(raw: unknown): CompareItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is CompareItem => (
    !!r && typeof r === "object" &&
    typeof (r as CompareItem).id === "string" &&
    typeof (r as CompareItem).name === "string"
  ));
}

function parseBookmarks(raw: unknown): BookmarkItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is BookmarkItem => (
    !!r && typeof r === "object" &&
    typeof (r as BookmarkItem).id === "string" &&
    typeof (r as BookmarkItem).name === "string"
  ));
}

function rowToData(row: Row): UserData {
  return {
    profile: {
      conditions: row.health_conditions ?? [],
      allergies: row.allergies ?? [],
      language: row.language_preference === "Hindi" ? "Hindi" : "English",
    },
    scanHistory: parseScanHistory(row.scan_history),
    scanCount: row.scan_count ?? 0,
    compareList: parseCompareList(row.compare_list),
    bookmarks: parseBookmarks(row.bookmarks),
    recentSearches: row.recent_searches ?? [],
    onboarded: !!row.onboarded,
  };
}

// ── Context ───────────────────────────────────────────────────────────────

interface UserDataContextValue {
  data: UserData;
  ready: boolean;              // true once first load has completed
  error: string | null;        // non-null when DB is misconfigured (see docs/cloud-migration.sql)

  // Mutations — all async, all write-through to the DB with optimistic
  // local updates. Failures revert the optimistic change and throw.
  setProfile: (updates: Partial<UserProfile>) => Promise<void>;
  recordScan: (product: { id: string; name: string; brand: string; category?: string; safety_score?: number | null; grade?: string | null }) => Promise<void>;
  addToCompare: (item: Omit<CompareItem, "addedAt">) => Promise<"added" | "already" | "full">;
  removeFromCompare: (id: string) => Promise<void>;
  clearCompare: () => Promise<void>;
  toggleBookmark: (item: Omit<BookmarkItem, "addedAt">) => Promise<"added" | "removed">;
  addRecentSearch: (q: string) => Promise<void>;
  markOnboarded: () => Promise<void>;
}

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, authAvailable } = useUser();
  const [data, setData] = useState<UserData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref mirror for optimistic updates — lets mutations compute "next state"
  // without waiting for React to commit prior setState calls.
  const dataRef = useRef<UserData>(EMPTY);
  const userIdRef = useRef<string | null>(null);

  // Load the user_profiles row. Creates one if missing so downstream
  // mutations always have a row to update.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Auth not configured (no anonymous sign-in). App must run in a
      // "setup required" mode — reads return empty, writes no-op.
      setData(EMPTY);
      dataRef.current = EMPTY;
      userIdRef.current = null;
      setReady(true);
      setError(authAvailable ? null : "setup_required");
      return;
    }

    userIdRef.current = user.id;
    let cancelled = false;

    const load = async () => {
      const { data: row, error: selErr } = await supabase
        .from("user_profiles")
        .select("health_conditions, allergies, language_preference, onboarded, scan_history, scan_count, recent_searches, compare_list, bookmarks")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (selErr) {
        // Most likely: user_profiles columns don't exist (migration not run).
        console.warn("user_profiles load failed:", selErr.message);
        setError("migration_required");
        setReady(true);
        return;
      }

      if (!row) {
        // First time — create empty row so the rest of the app can update it.
        const { error: insErr } = await supabase
          .from("user_profiles")
          // @ts-expect-error generated types miss new JSONB columns
          .insert({
            user_id: user.id,
            display_name: user.user_metadata?.full_name || user.email || "You",
          });
        if (insErr && insErr.code !== "23505") { // 23505 = unique_violation on race
          console.warn("user_profiles insert failed:", insErr.message);
        }
        setData(EMPTY);
        dataRef.current = EMPTY;
      } else {
        const parsed = rowToData(row as Row);
        setData(parsed);
        dataRef.current = parsed;
      }
      setError(null);
      setReady(true);
    };

    load();
    return () => { cancelled = true; };
  }, [user, authLoading, authAvailable]);

  // Helper: optimistic update + DB write. Reverts on failure.
  const mutate = useCallback(
    async (
      producer: (prev: UserData) => { next: UserData; dbPatch: Record<string, unknown> },
    ) => {
      const uid = userIdRef.current;
      if (!uid) return;
      const prev = dataRef.current;
      const { next, dbPatch } = producer(prev);
      setData(next);
      dataRef.current = next;
      const { error: updateErr } = await supabase
        .from("user_profiles")
        // @ts-expect-error generated types miss new JSONB columns
        .update(dbPatch)
        .eq("user_id", uid);
      if (updateErr) {
        // Revert on failure so UI stays consistent with server.
        setData(prev);
        dataRef.current = prev;
        throw new Error(updateErr.message);
      }
    },
    [],
  );

  // ── Mutations ──────────────────────────────────────────────────────────

  const setProfile = useCallback(async (updates: Partial<UserProfile>) => {
    await mutate((prev) => {
      const profile: UserProfile = { ...prev.profile, ...updates };
      return {
        next: { ...prev, profile },
        dbPatch: {
          health_conditions: profile.conditions,
          allergies: profile.allergies,
          language_preference: profile.language,
        },
      };
    });
  }, [mutate]);

  const recordScan: UserDataContextValue["recordScan"] = useCallback(async (product) => {
    await mutate((prev) => {
      const filtered = prev.scanHistory.filter((h) => h.id !== product.id);
      const record: ScanRecord = {
        id: product.id,
        name: product.name,
        brand: product.brand,
        score: product.safety_score ?? null,
        grade: product.grade ?? null,
        category: product.category || "Food",
        timestamp: Date.now(),
      };
      const history = [record, ...filtered].slice(0, HISTORY_MAX);
      const count = prev.scanCount + 1;
      return {
        next: { ...prev, scanHistory: history, scanCount: count },
        dbPatch: { scan_history: history, scan_count: count },
      };
    });
  }, [mutate]);

  const addToCompare = useCallback(async (item: Omit<CompareItem, "addedAt">) => {
    const prev = dataRef.current;
    if (prev.compareList.some((i) => i.id === item.id)) return "already" as const;
    if (prev.compareList.length >= COMPARE_MAX) return "full" as const;
    await mutate((p) => {
      const list: CompareItem[] = [...p.compareList, { ...item, addedAt: Date.now() }];
      return { next: { ...p, compareList: list }, dbPatch: { compare_list: list } };
    });
    return "added" as const;
  }, [mutate]);

  const removeFromCompare = useCallback(async (id: string) => {
    await mutate((prev) => {
      const list = prev.compareList.filter((i) => i.id !== id);
      return { next: { ...prev, compareList: list }, dbPatch: { compare_list: list } };
    });
  }, [mutate]);

  const clearCompare = useCallback(async () => {
    await mutate((prev) => ({
      next: { ...prev, compareList: [] },
      dbPatch: { compare_list: [] },
    }));
  }, [mutate]);

  const toggleBookmark = useCallback(async (item: Omit<BookmarkItem, "addedAt">) => {
    const prev = dataRef.current;
    const exists = prev.bookmarks.some((b) => b.id === item.id);
    if (exists) {
      await mutate((p) => {
        const list = p.bookmarks.filter((b) => b.id !== item.id);
        return { next: { ...p, bookmarks: list }, dbPatch: { bookmarks: list } };
      });
      return "removed" as const;
    }
    await mutate((p) => {
      // Cap at BOOKMARK_MAX by dropping the oldest.
      const withNew = [{ ...item, addedAt: Date.now() }, ...p.bookmarks].slice(0, BOOKMARK_MAX);
      return { next: { ...p, bookmarks: withNew }, dbPatch: { bookmarks: withNew } };
    });
    return "added" as const;
  }, [mutate]);

  const addRecentSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    await mutate((prev) => {
      const deduped = [
        trimmed,
        ...prev.recentSearches.filter((t) => t.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, RECENT_MAX);
      return {
        next: { ...prev, recentSearches: deduped },
        dbPatch: { recent_searches: deduped },
      };
    });
  }, [mutate]);

  const markOnboarded = useCallback(async () => {
    if (dataRef.current.onboarded) return;
    await mutate((prev) => ({
      next: { ...prev, onboarded: true },
      dbPatch: { onboarded: true },
    }));
  }, [mutate]);

  const value = useMemo<UserDataContextValue>(() => ({
    data,
    ready,
    error,
    setProfile,
    recordScan,
    addToCompare,
    removeFromCompare,
    clearCompare,
    toggleBookmark,
    addRecentSearch,
    markOnboarded,
  }), [data, ready, error, setProfile, recordScan, addToCompare, removeFromCompare, clearCompare, toggleBookmark, addRecentSearch, markOnboarded]);

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
}

export function useUserData() {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error("useUserData must be used inside UserDataProvider");
  return ctx;
}

// Narrow helpers so callers don't all have to know the shape:
export function hasPersonalization(p: UserProfile): boolean {
  return p.conditions.length > 0 || p.allergies.length > 0;
}

export const LIMITS = { HISTORY_MAX, RECENT_MAX, COMPARE_MAX, BOOKMARK_MAX };

// Re-exported for back-compat with existing component imports.
export type { IngredientAnalysis };
