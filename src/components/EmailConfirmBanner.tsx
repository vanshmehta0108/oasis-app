"use client";

// Banner that nudges users who signed up with email but haven't yet
// confirmed it. Until they confirm, server-side flows that depend on a
// confirmed email (password resets, account-delete email receipts, future
// transactional mail) are unreliable. We don't block app usage — that
// would punish users for our own onboarding friction — we just nudge.
//
// Auto-dismisses for the rest of the session once the user closes it.

import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import { useToast } from "@/lib/useToast";

export function EmailConfirmBanner() {
  const { user, emailConfirmed, isAnonymous, loading } = useUser();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("sift-email-banner-dismissed") === "1") {
      setDismissed(true);
    }
  }, []);

  if (loading || !user || isAnonymous || emailConfirmed || dismissed) return null;

  function dismiss() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("sift-email-banner-dismissed", "1");
    }
    setDismissed(true);
  }

  async function resend() {
    if (!user?.email || resending) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });
      if (error) {
        showToast(t('email_confirm_resend_failed', language), "error");
      } else {
        showToast(t('email_confirm_resend_sent', language), "info");
        dismiss();
      }
    } catch {
      showToast(t('email_confirm_resend_failed', language), "error");
    } finally {
      setResending(false);
    }
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex items-center gap-2 px-4 py-2 text-[11px] font-medium"
      style={{ background: "#EBF3FF", borderBottom: "1px solid #BDD9FF", color: "#0056CC" }}
    >
      <Mail size={12} aria-hidden="true" className="shrink-0" />
      <span className="flex-1 leading-tight">
        {t('email_confirm_banner', language).replace("{email}", user.email ?? "")}
      </span>
      <button
        onClick={resend}
        disabled={resending}
        className="shrink-0 underline disabled:opacity-50"
      >
        {resending ? t('email_confirm_sending', language) : t('email_confirm_resend', language)}
      </button>
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
