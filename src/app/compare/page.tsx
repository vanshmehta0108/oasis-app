"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, X, Scale, Plus, Trophy, AlertTriangle, ShieldCheck, Info } from "lucide-react";
import Link from "next/link";
import { ScoreRing } from "@/components/ScoreRing";
import { useUserData, LIMITS, type CompareItem } from "@/lib/userData";
import { useLanguage } from "@/components/LanguageProvider";
import { t, type Language } from "@/lib/i18n";
import { getProductById } from "@/lib/db";

// ── Types ────────────────────────────────────────────────────────────────────

interface IngredientAnalysis {
  name: string;
  risk_level: "safe" | "caution" | "warning" | "danger";
  explanation: string;
}

interface FullProduct {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  safety_score: number | null;
  analysis?: {
    summary?: string;
    ingredients?: IngredientAnalysis[];
    warnings?: string[];
    healthier_tip?: string;
  };
  nutritional_info?: Record<string, number | null | undefined>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score == null) return "#8E8E93";
  if (score >= 75) return "#34C759";
  if (score >= 55) return "#FF9F0A";
  if (score >= 35) return "#FF6B00";
  return "#FF3B30";
}

function gradeLabel(score: number | null, lang: Language): string {
  if (score == null) return t("not_scored", lang);
  if (score >= 75) return t("safe", lang);
  if (score >= 55) return t("grade_b", lang);
  if (score >= 35) return t("grade_c", lang);
  return t("grade_d", lang);
}

function formatNutrient(val: number | null | undefined, unit: string): string {
  if (val == null) return "—";
  return `${val}${unit}`;
}

function riskCounts(ingredients: IngredientAnalysis[] | undefined) {
  if (!ingredients?.length) return null;
  return {
    danger: ingredients.filter((i) => i.risk_level === "danger").length,
    warning: ingredients.filter((i) => i.risk_level === "warning").length,
    caution: ingredients.filter((i) => i.risk_level === "caution").length,
    safe: ingredients.filter((i) => i.risk_level === "safe").length,
  };
}

function pickWinner(items: CompareItem[]): CompareItem | null {
  const scored = items.filter((i) => i.safety_score != null);
  if (scored.length === 0) return null;
  return scored.reduce((a, b) =>
    (a.safety_score ?? 0) > (b.safety_score ?? 0) ? a : b
  );
}

function winnerReason(winner: FullProduct, others: FullProduct[]): string {
  const parts: string[] = [];
  const score = winner.safety_score;
  if (score != null) {
    const otherScores = others
      .map((o) => o.safety_score)
      .filter((s): s is number => s != null);
    if (otherScores.length > 0) {
      const diff = score - Math.max(...otherScores);
      if (diff > 0) parts.push(`${diff} points safer than the nearest alternative`);
    }
  }
  const wCounts = riskCounts(winner.analysis?.ingredients);
  if (wCounts && wCounts.danger === 0) parts.push("no dangerous ingredients");
  const otherDangers = others.map((o) => riskCounts(o.analysis?.ingredients)?.danger ?? 0);
  if (wCounts && otherDangers.length > 0 && wCounts.danger < Math.max(...otherDangers))
    parts.push("fewest risky ingredients");
  const wWarnings = winner.analysis?.warnings?.length ?? 0;
  const otherWarningCounts = others.map((o) => o.analysis?.warnings?.length ?? 0);
  if (otherWarningCounts.length > 0 && wWarnings < Math.max(...otherWarningCounts))
    parts.push("fewer health warnings");
  return parts.length > 0 ? `Scores highest with ${parts.join(", ")}.` : "Highest overall safety score.";
}

// ── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.05]">
        <span className="text-oasis-muted">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-oasis-muted">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Column grid helpers ──────────────────────────────────────────────────────

function ColGrid({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className={`grid divide-x divide-black/[0.05]`} style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
      {children}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { data, ready, removeFromCompare, clearCompare } = useUserData();
  const { language } = useLanguage();
  const items = data.compareList;

  const [fullProducts, setFullProducts] = useState<(FullProduct | null)[]>([]);
  const [loading, setLoading] = useState(false);

  // Strip the "off-" / "web-" routing prefix before looking up in the DB,
  // since those products are stored under their bare barcode.
  function resolveId(id: string): string {
    if (id.startsWith("off-")) return id.slice(4);
    if (id.startsWith("web-")) return id.slice(4);
    return id;
  }

  useEffect(() => {
    if (items.length === 0) { setFullProducts([]); return; }
    setLoading(true);
    Promise.all(items.map((item) => getProductById(resolveId(item.id)).catch(() => null)))
      .then((results) => setFullProducts(results as (FullProduct | null)[]))
      .finally(() => setLoading(false));
  }, [items]);

  const winner = pickWinner(items);
  const n = items.length;

  return (
    <div className="min-h-dvh pb-24" style={{ background: "#F2F2F7" }}>
      <div className="max-w-lg mx-auto px-4 pt-14">
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
              <span className="text-xs font-medium text-oasis-text">{t("back", language)}</span>
            </motion.div>
          </Link>
        </div>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[28px] font-bold text-black tracking-tight">{t("compare_title", language)}</h1>
          {items.length > 0 && (
            <button
              onClick={() => { if (confirm("Remove all products from comparison?")) void clearCompare(); }}
              className="text-xs font-medium text-oasis-muted"
            >
              {t("clear_all", language)}
            </button>
          )}
        </div>
        <p className="text-xs text-oasis-muted mb-5">
          {t("compare_subtitle", language)} — up to {LIMITS.COMPARE_MAX} products.
        </p>

        {/* Empty state */}
        {!ready || (ready && items.length === 0) ? (
          !ready ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 rounded-full border-2 border-[#007AFF]/20 border-t-[#007AFF] animate-spin" />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "#F2F2F7" }}>
                <Scale size={32} className="text-oasis-muted" />
              </div>
              <p className="text-sm font-medium text-oasis-text mb-2">{t("nothing_to_compare", language)}</p>
              <p className="text-xs text-oasis-muted max-w-xs mb-5">{t("nothing_to_compare_desc", language)}</p>
              <Link
                href="/search"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#007AFF] text-white text-sm font-semibold"
              >
                <Plus size={14} />
                {t("browse_products", language)}
              </Link>
            </motion.div>
          )
        ) : (
          <div className="space-y-3">

            {/* ── Best pick banner ── */}
            {winner && items.length > 1 && (() => {
              const winnerFull = fullProducts[items.findIndex(i => i.id === winner.id)];
              return (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl px-4 py-3.5 flex items-start gap-3"
                  style={{ background: "linear-gradient(135deg, #F0FBF4, #D1F5DE)", border: "1px solid rgba(30,128,64,0.2)" }}
                >
                  <Trophy size={20} className="mt-0.5 shrink-0" style={{ color: "#1E8040" }} />
                  <div>
                    <p className="text-[13px] font-bold" style={{ color: "#1E8040" }}>Best pick: {winner.name}</p>
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "#2A6B40" }}>
                      {winnerFull ? winnerReason(winnerFull, fullProducts.filter((p, i) => p && items[i].id !== winner.id) as FullProduct[]) : "Highest overall safety score."}
                    </p>
                  </div>
                </motion.div>
              );
            })()}

            {/* ── Score comparison ── */}
            <Section title="Safety Score" icon={<ShieldCheck size={14} />}>
              {/* Product header row */}
              <ColGrid n={n}>
                {items.map((item, i) => {
                  const isBest = winner?.id === item.id && items.length > 1;
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col items-center px-2 py-3 gap-2 ${isBest ? "bg-[#F0FBF4]" : ""}`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[9px] font-semibold uppercase tracking-wide truncate max-w-[70%]" style={{ color: isBest ? "#1E8040" : "#8E8E93" }}>
                          {isBest ? "★ Best" : ""}
                        </span>
                        <button
                          onClick={() => void removeFromCompare(item.id)}
                          className="w-5 h-5 rounded-full flex items-center justify-center bg-black/[0.06]"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X size={10} className="text-oasis-muted" />
                        </button>
                      </div>
                      <ScoreRing score={item.safety_score} grade={item.grade} size="md" animate={false} />
                      <div className="text-center">
                        <p className="text-[11px] font-semibold text-black truncate w-full max-w-[90px]">{item.name}</p>
                        <p className="text-[10px] text-oasis-muted truncate">{item.brand}</p>
                      </div>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${scoreColor(item.safety_score)}18`, color: scoreColor(item.safety_score) }}
                      >
                        {gradeLabel(item.safety_score, language)}
                      </span>
                    </div>
                  );
                })}
              </ColGrid>
              {/* Score bars */}
              <div className="px-3 pb-3">
                <ColGrid n={n}>
                  {items.map((item) => (
                    <div key={item.id} className="px-1">
                      <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${item.safety_score ?? 0}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          style={{ background: scoreColor(item.safety_score) }}
                        />
                      </div>
                      <p className="text-center text-[10px] font-bold mt-1 tabular-nums" style={{ color: scoreColor(item.safety_score) }}>
                        {item.safety_score ?? "?"}/100
                      </p>
                    </div>
                  ))}
                </ColGrid>
              </div>
            </Section>

            {/* ── Ingredient safety breakdown ── */}
            {loading ? (
              <div className="rounded-2xl bg-white border border-black/[0.06] p-6 flex justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-[#007AFF]/20 border-t-[#007AFF] animate-spin" />
              </div>
            ) : fullProducts.some(p => p?.analysis?.ingredients?.length) && (
              <Section title="Ingredient Safety" icon={<AlertTriangle size={14} />}>
                <ColGrid n={n}>
                  {fullProducts.map((product, i) => {
                    const counts = riskCounts(product?.analysis?.ingredients);
                    return (
                      <div key={items[i].id} className="px-3 py-3 space-y-1.5">
                        {counts ? (
                          <>
                            {counts.danger > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#FF3B30] shrink-0" />
                                <span className="text-[11px] text-[#FF3B30] font-medium">{counts.danger} danger</span>
                              </div>
                            )}
                            {counts.warning > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#FF6B00] shrink-0" />
                                <span className="text-[11px] text-[#FF6B00] font-medium">{counts.warning} warning</span>
                              </div>
                            )}
                            {counts.caution > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#FF9F0A] shrink-0" />
                                <span className="text-[11px] text-[#FF9F0A] font-medium">{counts.caution} caution</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#34C759] shrink-0" />
                              <span className="text-[11px] text-[#34C759] font-medium">{counts.safe} safe</span>
                            </div>
                          </>
                        ) : (
                          <p className="text-[11px] text-oasis-muted">No data</p>
                        )}
                      </div>
                    );
                  })}
                </ColGrid>
              </Section>
            )}

            {/* ── Key warnings ── */}
            {fullProducts.some(p => p?.analysis?.warnings?.length) && (
              <Section title="Key Warnings" icon={<AlertTriangle size={14} />}>
                <ColGrid n={n}>
                  {fullProducts.map((product, i) => {
                    const warnings = product?.analysis?.warnings ?? [];
                    return (
                      <div key={items[i].id} className="px-3 py-3 space-y-1">
                        {warnings.length === 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#34C759]" />
                            <span className="text-[11px] text-[#34C759] font-medium">None</span>
                          </div>
                        ) : warnings.slice(0, 3).map((w, wi) => (
                          <div key={wi} className="flex items-start gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF9F0A] mt-1.5 shrink-0" />
                            <span className="text-[10px] text-oasis-text leading-relaxed line-clamp-2">{w}</span>
                          </div>
                        ))}
                        {warnings.length > 3 && (
                          <span className="text-[10px] text-oasis-muted">+{warnings.length - 3} more</span>
                        )}
                      </div>
                    );
                  })}
                </ColGrid>
              </Section>
            )}

            {/* ── Nutrition ── */}
            {fullProducts.some(p => p?.nutritional_info && Object.keys(p.nutritional_info).length > 0) && (
              <Section title="Nutrition (per 100g)" icon={<Info size={14} />}>
                {[
                  { label: "Calories", key: "energy_kcal", unit: " kcal" },
                  { label: "Sugar", key: "total_sugars_g", unit: "g" },
                  { label: "Sodium", key: "sodium_mg", unit: "mg" },
                  { label: "Fat", key: "total_fat_g", unit: "g" },
                  { label: "Protein", key: "protein_g", unit: "g" },
                ].map(({ label, key, unit }) => {
                  const values = fullProducts.map(p => p?.nutritional_info?.[key] as number | null | undefined);
                  if (values.every(v => v == null)) return null;
                  // Find best (lowest for sugar/sodium/fat, highest for protein)
                  const comparableVals = values.map(v => v ?? null).filter(v => v != null) as number[];
                  const isBestLow = ["total_sugars_g", "sodium_mg", "total_fat_g"].includes(key);
                  const bestVal = isBestLow ? Math.min(...comparableVals) : Math.max(...comparableVals);
                  return (
                    <div key={key} className="border-b border-black/[0.04] last:border-0">
                      <div className="px-4 py-2">
                        <p className="text-[10px] font-semibold text-oasis-muted mb-1.5">{label}</p>
                        <ColGrid n={n}>
                          {values.map((val, i) => {
                            const isBest = val != null && val === bestVal && comparableVals.length > 1;
                            return (
                              <div key={items[i].id} className={`text-center px-1 ${isBest ? "text-[#34C759]" : "text-black"}`}>
                                <span className={`text-[13px] font-bold tabular-nums ${isBest ? "text-[#34C759]" : "text-black"}`}>
                                  {formatNutrient(val ?? null, unit)}
                                </span>
                                {isBest && <div className="text-[9px] font-medium text-[#34C759]">best</div>}
                              </div>
                            );
                          })}
                        </ColGrid>
                      </div>
                    </div>
                  );
                })}
              </Section>
            )}

            {/* ── Summary ── */}
            {items.some(i => i.summary) && (
              <Section title="AI Summary" icon={<Info size={14} />}>
                <ColGrid n={n}>
                  {items.map((item, i) => (
                    <div key={item.id} className="px-3 py-3">
                      {item.summary ? (
                        <p className="text-[10px] text-oasis-text leading-relaxed line-clamp-4">{item.summary}</p>
                      ) : (
                        <p className="text-[10px] text-oasis-muted italic">Not yet analyzed</p>
                      )}
                      <Link
                        href={`/product/${item.id}`}
                        className="inline-block mt-2 text-[10px] font-semibold text-[#007AFF]"
                      >
                        View full →
                      </Link>
                    </div>
                  ))}
                </ColGrid>
              </Section>
            )}

            {/* ── Add another ── */}
            {items.length < LIMITS.COMPARE_MAX && (
              <Link
                href="/search"
                className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-oasis-border text-sm font-medium text-oasis-muted"
              >
                <Plus size={16} />
                {t("add_another_product", language)}
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
