"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    // The Supabase client parses the URL fragment automatically when
    // detectSessionInUrl: true. We just wait briefly for that to settle
    // and then bounce back to the page the user was on, or home.
    let cancelled = false;
    const finish = async () => {
      // Give the client a beat to ingest the URL hash.
      await new Promise((r) => setTimeout(r, 200));
      await supabase.auth.getSession();
      if (cancelled) return;
      const next = params.get("next") || "/";
      // Use replace so the callback URL isn't in browser history.
      router.replace(next);
    };
    finish();
    return () => { cancelled = true; };
  }, [router, params]);

  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: "#F2F2F7" }}>
      <p className="text-sm" style={{ color: "#8E8E93" }}>Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
