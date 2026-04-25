"use client";

import { useEffect, useState } from "react";
import { useUserData } from "@/lib/userData";
import { AlertTriangle, X } from "lucide-react";

export function SetupBanner() {
  const { error } = useUserData();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("sift-banner-dismissed") === "1") setDismissed(true);
  }, []);

  if (!error || dismissed) return null;

  const message =
    error === "setup_required"
      ? "Sign in to save your scan history and health profile across devices."
      : "Database migration pending — run docs/cloud-migration.sql in Supabase.";

  function dismiss() {
    sessionStorage.setItem("sift-banner-dismissed", "1");
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-center gap-2 px-4 py-2 text-[11px] font-medium"
      style={{ background: "#FFF3CD", borderBottom: "1px solid #FFD84D", color: "#7A4A00" }}
    >
      <AlertTriangle size={12} aria-hidden="true" className="shrink-0" />
      <span className="flex-1 leading-tight">{message}</span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
      >
        <X size={11} />
      </button>
    </div>
  );
}
