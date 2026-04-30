"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import { ensureSession, isAnonymous, type User } from "./auth";

interface UserContextValue {
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  // True when anonymous auth is disabled server-side, so the app is
  // running in purely-local mode. UIs use this to hide sign-in affordances
  // that would fail.
  authAvailable: boolean;
  // True when the user has signed up with email but not yet confirmed it.
  // Drives the "confirm your email" banner. Anonymous users and Google-
  // signed-in users always have emailConfirmed === true.
  emailConfirmed: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  isAnonymous: true,
  authAvailable: false,
  emailConfirmed: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authAvailable, setAuthAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    ensureSession()
      .then((u) => {
        if (!mounted) return;
        setUser(u);
        setAuthAvailable(!!u);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Keep user in sync on sign-in, sign-out, token refresh, etc.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      if (session?.user) setAuthAvailable(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Supabase exposes confirmation state on the user object. Treat anon users
  // and providers without emails (e.g. magic-link before confirm) as
  // "unconfirmed" so the banner can prompt them.
  const anon = isAnonymous(user);
  const emailConfirmed = !user || anon
    ? true
    : !!(user as User & { email_confirmed_at?: string | null }).email_confirmed_at;

  return (
    <UserContext.Provider
      value={{ user, loading, isAnonymous: anon, authAvailable, emailConfirmed }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
