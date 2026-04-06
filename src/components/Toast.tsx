"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { useToast } from "@/lib/useToast";

const variants = {
  success: {
    bg: "bg-emerald-500/90",
    icon: CheckCircle,
  },
  error: {
    bg: "bg-red-500/90",
    icon: XCircle,
  },
  info: {
    bg: "bg-blue-500/90",
    icon: Info,
  },
};

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 pt-[max(0.75rem,env(safe-area-inset-top))] px-4 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const cfg = variants[toast.type];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] as const }}
              className={`${cfg.bg} backdrop-blur-lg rounded-xl px-4 py-3 flex items-center gap-2.5 shadow-lg max-w-sm w-full pointer-events-auto`}
              role="alert"
            >
              <Icon size={18} className="text-white shrink-0" aria-hidden="true" />
              <span className="text-sm font-medium text-white flex-1">{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 rounded-full p-0.5 hover:bg-white/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Dismiss notification"
              >
                <X size={14} className="text-white/80" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
