"use client";

import { useUserData } from "@/lib/userData";
import { AlertTriangle } from "lucide-react";

// Banner shown app-wide when cloud storage isn't ready. Non-dismissible
// because the app can't actually save anything until the developer
// completes setup — a dismiss button would imply the user can work
// around it, but they can't.
export function SetupBanner() {
  const { error } = useUserData();
  if (!error) return null;

  const message = error === "setup_required"
    ? "Cloud storage isn't configured yet. Your data won't save between sessions until setup is complete."
    : "Database migration is pending. Nothing will save until the admin runs docs/cloud-migration.sql.";

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-center gap-2 px-4 py-2 text-[11px] font-medium"
      style={{
        background: "#FFF3CD",
        borderBottom: "1px solid #FFD84D",
        color: "#7A4A00",
      }}
    >
      <AlertTriangle size={12} aria-hidden="true" />
      <span className="flex-1 leading-tight">{message}</span>
    </div>
  );
}
