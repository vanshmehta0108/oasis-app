"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3, ease: [0.33, 1, 0.68, 1] as const }}
          className="fixed top-0 left-0 right-0 z-[90] bg-amber-500/90 backdrop-blur-lg px-4 py-2.5 flex items-center justify-center gap-2"
          style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
          role="alert"
          aria-live="assertive"
        >
          <WifiOff size={16} className="text-amber-950 shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-amber-950">
            You&apos;re offline. Some features may be unavailable.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
