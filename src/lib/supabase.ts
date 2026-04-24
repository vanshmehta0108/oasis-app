import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// Single shared client for the whole app. Auth options only matter on the
// client; server-side (API routes) use the same client without a session,
// which is the behavior we want — API routes authenticate via the user's
// bearer token if/when we start passing it explicitly.
export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Persist the session in localStorage so refreshes don't log the user out.
    persistSession: typeof window !== "undefined",
    // Refresh the access token automatically before it expires.
    autoRefreshToken: typeof window !== "undefined",
    // Support the OAuth callback URL fragment.
    detectSessionInUrl: typeof window !== "undefined",
    storageKey: "sift-auth",
  },
});
