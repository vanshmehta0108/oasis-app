"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ShieldCheck, AlertTriangle, AlertCircle, Skull } from "lucide-react";
import type { IngredientAnalysis } from "@/lib/mockData";

const riskConfig = {
  safe: {
    color: "text-emerald-400",
    bg: "bg-emerald-400/5",
    borderLeft: "border-l-emerald-400",
    borderOuter: "border-emerald-400/10",
    expandBg: "bg-emerald-400/[0.03]",
    pillBg: "bg-emerald-400/10",
    icon: ShieldCheck,
    label: "Safe",
  },
  caution: {
    color: "text-yellow-400",
    bg: "bg-yellow-400/5",
    borderLeft: "border-l-yellow-400",
    borderOuter: "border-yellow-400/10",
    expandBg: "bg-yellow-400/[0.03]",
    pillBg: "bg-yellow-400/10",
    icon: AlertTriangle,
    label: "Caution",
  },
  warning: {
    color: "text-orange-400",
    bg: "bg-orange-400/5",
    borderLeft: "border-l-orange-400",
    borderOuter: "border-orange-400/10",
    expandBg: "bg-orange-400/[0.03]",
    pillBg: "bg-orange-400/10",
    icon: AlertCircle,
    label: "Warning",
  },
  danger: {
    color: "text-red-400",
    bg: "bg-red-400/5",
    borderLeft: "border-l-red-400",
    borderOuter: "border-red-400/10",
    expandBg: "bg-red-400/[0.03]",
    pillBg: "bg-red-400/10",
    icon: Skull,
    label: "Danger",
  },
};

const SEVERITY: Record<string, number> = { danger: 0, warning: 1, caution: 2, safe: 3 };
const INITIAL_VISIBLE = 5;

export function IngredientList({ ingredients }: { ingredients: (IngredientAnalysis | { name: string; risk_level?: string; risk?: string; explanation: string })[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const sorted = [...ingredients.filter(Boolean)].sort((a, b) => {
    const ra = ("risk" in a ? a.risk : (a as { risk_level?: string }).risk_level) ?? "caution";
    const rb = ("risk" in b ? b.risk : (b as { risk_level?: string }).risk_level) ?? "caution";
    return (SEVERITY[ra] ?? 2) - (SEVERITY[rb] ?? 2);
  });

  const visible = showAll ? sorted : sorted.slice(0, INITIAL_VISIBLE);
  const hidden = sorted.length - INITIAL_VISIBLE;

  return (
    <div className="space-y-2" role="list" aria-label="Ingredient analysis">
      {visible.map((ing, i) => {
        // Support both "risk" and "risk_level" field names (mockData vs AI response)
        const riskKey = (("risk" in ing ? ing.risk : (ing as { risk_level?: string }).risk_level) || "caution") as string;
        const cfg = riskConfig[riskKey as keyof typeof riskConfig] ?? riskConfig.caution;
        const Icon = cfg.icon;
        const itemKey = `${ing.name}-${i}`;
        const isOpen = expanded === itemKey;

        return (
          <motion.button
            key={itemKey}
            onClick={() => setExpanded(isOpen ? null : itemKey)}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className={`w-full text-left rounded-xl border ${cfg.borderOuter} ${cfg.bg} border-l-[3px] ${cfg.borderLeft} p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-green`}
            layout
            role="listitem"
            aria-expanded={isOpen}
            aria-label={`${ing.name}: ${cfg.label} risk level. ${isOpen ? "Collapse" : "Expand"} for details`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon size={16} className={`${cfg.color} shrink-0`} aria-hidden="true" />
                <span className="text-sm font-medium text-oasis-text truncate">
                  {ing.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.pillBg} ${cfg.color}`}>
                  {cfg.label}
                </span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  aria-hidden="true"
                >
                  <ChevronDown size={14} className="text-oasis-muted" />
                </motion.div>
              </div>
            </div>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className={`mt-2 pt-2 border-t border-black/[0.06] rounded-lg ${cfg.expandBg} p-2 -mx-1`}>
                    <p className="text-xs text-oasis-text-secondary leading-relaxed">
                      {ing.explanation}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
      {!showAll && hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full text-center text-xs font-semibold py-2.5 rounded-xl bg-white border border-black/[0.08] text-oasis-muted hover:text-oasis-text transition-colors"
        >
          Show {hidden} more ingredient{hidden !== 1 ? "s" : ""} →
        </button>
      )}
      {showAll && sorted.length > INITIAL_VISIBLE && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full text-center text-xs font-semibold py-2.5 rounded-xl bg-white border border-black/[0.08] text-oasis-muted hover:text-oasis-text transition-colors"
        >
          Show less ↑
        </button>
      )}
    </div>
  );
}
