"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="min-h-dvh flex flex-col items-center justify-center bg-[#F2F2F7] px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-[20px] font-bold text-black mb-2">Something went wrong</h1>
        <p className="text-sm text-[#8E8E93] mb-6 max-w-xs">
          An unexpected error occurred. Our team has been notified.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-full bg-[#007AFF] text-white text-sm font-semibold"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
