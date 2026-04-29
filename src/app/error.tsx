"use client";

import { useEffect, useState } from "react";
import { t, type Language } from "@/lib/i18n";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  // Read language from localStorage directly — LanguageProvider may not be
  // mounted by the time this error boundary renders, so we don't rely on
  // useLanguage() here.
  const [lang, setLang] = useState<Language>("en");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sift-language");
    if (stored === "hi" || stored === "en") setLang(stored);
  }, []);

  return (
    <div className="min-h-dvh bg-oasis-black flex flex-col items-center justify-center px-6 text-center">
      {/* Error icon */}
      <div className="w-16 h-16 rounded-2xl bg-oasis-red/20 flex items-center justify-center mb-6">
        <svg
          className="w-8 h-8 text-oasis-red"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      {/* Message */}
      <h2 className="text-2xl font-semibold text-oasis-text mb-3">
        {t('error_something_wrong', lang)}
      </h2>
      <p className="text-oasis-muted max-w-sm mb-2">
        {t('error_generic_body', lang)}
      </p>
      {error.digest && (
        <p className="text-xs text-oasis-muted/60 mb-8 font-mono">
          Error ID: {error.digest}
        </p>
      )}

      {/* Retry */}
      <button
        onClick={reset}
        className="px-6 py-3 bg-oasis-green text-oasis-black font-semibold rounded-xl hover:bg-oasis-green-dim transition-colors"
      >
        {t('error_try_again', lang)}
      </button>
    </div>
  );
}
