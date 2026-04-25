"use client";

import { motion } from "framer-motion";
import { ArrowLeft, X, Scale, Plus } from "lucide-react";
import Link from "next/link";
import { ScoreRing } from "@/components/ScoreRing";
import { useUserData, LIMITS, type CompareItem } from "@/lib/userData";
import { useLanguage } from "@/components/LanguageProvider";
import { t, type Language } from "@/lib/i18n";

function gradient(score: number | null): string {
  if (score == null) return "linear-gradient(135deg, #F2F2F7, #E5E5EA)";
  if (score >= 75) return "linear-gradient(135deg, #F0FBF4, #D1F5DE)";
  if (score >= 55) return "linear-gradient(135deg, #FFF8E6, #FFE9B8)";
  if (score >= 35) return "linear-gradient(135deg, #FFF2E8, #FFD9BD)";
  return "linear-gradient(135deg, #FFF0EE, #FFCFC9)";
}

function verdict(score: number | null, lang: Language): string {
  if (score == null) return t('not_scored', lang);
  if (score >= 75) return t('safe', lang);
  if (score >= 55) return t('grade_b', lang);
  if (score >= 35) return t('grade_c', lang);
  return t('grade_d', lang);
}

export default function ComparePage() {
  const { data, ready, removeFromCompare, clearCompare } = useUserData();
  const { language } = useLanguage();
  const items = data.compareList;

  const best = items.reduce<CompareItem | null>((acc, cur) => {
    if (cur.safety_score == null) return acc;
    if (!acc || acc.safety_score == null) return cur;
    return cur.safety_score > acc.safety_score ? cur : acc;
  }, null);

  return (
    <div className="min-h-dvh pb-24" style={{ background: "#F2F2F7" }}>
      <div className="max-w-lg mx-auto px-5 pt-14">
        {/* Header */}
        <div className="fixed top-4 left-4 z-50">
          <Link href="/" aria-label="Go back to home">
            <motion.div
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-full glass-light border border-black/[0.08]"
            >
              <ArrowLeft size={16} className="text-oasis-text" aria-hidden="true" />
              <span className="text-xs font-medium text-oasis-text">{t('back', language)}</span>
            </motion.div>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[28px] font-bold text-black tracking-tight">{t('compare_title', language)}</h1>
          {items.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Remove all products from comparison?")) void clearCompare();
              }}
              className="text-xs font-medium text-oasis-muted"
            >
              {t('clear_all', language)}
            </button>
          )}
        </div>
        <p className="text-xs text-oasis-muted mb-6">
          {t('compare_subtitle', language)} — up to {LIMITS.COMPARE_MAX} products.
        </p>

        {!ready ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-2 border-[#007AFF]/20 border-t-[#007AFF] animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "#F2F2F7" }}>
              <Scale size={32} className="text-oasis-muted" />
            </div>
            <p className="text-sm font-medium text-oasis-text mb-2">{t('nothing_to_compare', language)}</p>
            <p className="text-xs text-oasis-muted max-w-xs mb-5">
              {t('nothing_to_compare_desc', language)}
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#007AFF] text-white text-sm font-semibold"
            >
              <Plus size={14} />
              {t('browse_products', language)}
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => {
              const isBest = best?.id === item.id && items.length > 1;
              const scoreColor = (item.safety_score ?? 0) >= 70 ? "#34C759" : (item.safety_score ?? 0) >= 50 ? "#FF9F0A" : "#FF3B30";
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative rounded-2xl overflow-hidden border bg-white ${isBest ? "border-[#1E8040]/30" : "border-black/[0.06]"}`}
                  style={{ boxShadow: isBest ? "0 2px 12px rgba(30,128,64,0.10)" : "0 1px 3px rgba(0,0,0,0.06)" }}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-20 pointer-events-none"
                    style={{ background: gradient(item.safety_score), opacity: 0.6 }}
                  />
                  {isBest && (
                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1E8040] text-white text-[10px] font-bold">
                      ✓ {t('best_pick', language)}
                    </div>
                  )}
                  <button
                    onClick={() => void removeFromCompare(item.id)}
                    aria-label={`Remove ${item.name} from compare`}
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center bg-white border border-black/[0.08]"
                  >
                    <X size={14} className="text-oasis-muted" />
                  </button>

                  <Link href={`/product/${item.id}`} className="relative block p-4">
                    <div className={`flex items-center gap-3 ${isBest ? "mt-4" : ""}`}>
                      <ScoreRing score={item.safety_score} grade={item.grade} size="md" animate={false} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-black truncate">{item.name}</p>
                        <p className="text-xs text-oasis-muted truncate">{item.brand}</p>
                        <span className="inline-block text-[10px] px-2 py-0.5 mt-1.5 rounded-full bg-[#007AFF]/10 text-[#007AFF] font-medium">
                          {verdict(item.safety_score, language)}
                        </span>
                      </div>
                    </div>

                    {/* Score bar */}
                    <div className="mt-3 h-2 rounded-full bg-black/[0.06] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.safety_score ?? 0}%` }}
                        transition={{ duration: 0.7, delay: 0.1 + i * 0.1, ease: "easeOut" }}
                        style={{ background: scoreColor }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-oasis-muted">0</span>
                      <span className="text-[10px] font-semibold tabular-nums" style={{ color: scoreColor }}>
                        {item.safety_score ?? "?"}/100
                      </span>
                      <span className="text-[10px] text-oasis-muted">100</span>
                    </div>

                    {item.summary && (
                      <p className="text-xs text-oasis-text-secondary leading-relaxed mt-3 line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                  </Link>
                </motion.div>
              );
            })}

            {items.length < LIMITS.COMPARE_MAX && (
              <Link
                href="/search"
                className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-oasis-border text-sm font-medium text-oasis-muted"
              >
                <Plus size={16} />
                {t('add_another_product', language)}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
