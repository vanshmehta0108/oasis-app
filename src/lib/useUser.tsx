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
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  isAnonymous: true,
  authAvailable: false,
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

  return (
    <UserContext.Provider
      value={{ user, loading, isAnonymous: isAnonymous(user), authAvailable }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
