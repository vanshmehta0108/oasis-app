"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera, ChevronRight, TrendingDown, Shield, ShieldAlert, Scale,
  UtensilsCrossed, Coffee, Popcorn, Sparkles, Baby, Home as HomeIcon, Package, UserCircle2
} from "lucide-react";
import dynamic from "next/dynamic";
import { ProductCard } from "@/components/ProductCard";
import { ScoreRing } from "@/components/ScoreRing";
// Lazy-load Onboarding — most home loads are returning users who've already
// finished it, so its bundle (framer-motion stages + i18n + custom-allergy
// form) doesn't need to ship up-front.
const Onboarding = dynamic(
  () => import("@/components/Onboarding").then((m) => m.Onboarding),
  { ssr: false },
);
import { EditorialCard } from "@/components/EditorialCard";
import { categories } from "@/lib/mockData";
import type { Product } from "@/lib/mockData";
import { getTrendingProducts, getWorstRated, getRecentProducts } from "@/lib/db";
import { useUserData } from "@/lib/userData";
import { useUser } from "@/lib/useUser";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import { getCurrentIssue } from "@/lib/editorial";
import { useEffect, useState } from "react";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.33, 1, 0.68, 1] as const } },
};

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    const duration = 1000;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return <span>{count.toLocaleString()}{suffix}</span>;
}

const categoryIconMap: Record<string, { Icon: React.ElementType; bg: string; color: string }> = {
  Food:      { Icon: UtensilsCrossed, bg: "#FFF3E8", color: "#FF6B00" },
  Beverages: { Icon: Coffee,          bg: "#EBF3FF", color: "#007AFF" },
  Snacks:    { Icon: Popcorn,         bg: "#FFF8E6", color: "#B87800" },
  Skincare:  { Icon: Sparkles,        bg: "#F5EEFF", color: "#8B5CF6" },
  Baby:      { Icon: Baby,            bg: "#FFF0F5", color: "#FF2D78" },
  Household: { Icon: HomeIcon,        bg: "#F0FBF4", color: "#1E8040" },
};

function mapDbProduct(p: Record<string, unknown>): Product {
  const analysis = p.analysis as Record<string, unknown> | null;
  return {
    id: (p.barcode as string) || (p.id as string),
    barcode: (p.barcode as string) || "",
    name: (p.name as string) || "",
    brand: (p.brand as string) || "Unknown",
    category: (p.category as string) || "food",
    ingredients: (p.ingredients as string[]) || [],
    safety_score: p.safety_score != null ? (p.safety_score as number) : null,
    grade: ((p.score_grade as string) || null) as Product["grade"],
    image_url: (p.image_url as string) || "",
    analysis: analysis
      ? { summary: (analysis.summary as string) || "", ingredients: [], warnings: (analysis.warnings as string[]) || [], healthier_alternative: (analysis.healthier_alternative as string) || "" }
      : { summary: "", ingredients: [], warnings: [], healthier_alternative: "" },
  };
}

const categoryMap: Record<string, string> = {
  food: "Food", beverage: "Beverages", snack: "Snacks",
  skincare: "Skincare", baby_food: "Baby", household: "Household",
};

export default function HomeClient() {
  const { data: userData, ready: userReady, markOnboarded } = useUserData();
  const { isAnonymous } = useUser();
  const { language } = useLanguage();
  const [trending, setTrending] = useState<Product[]>([]);
  const [worst, setWorst] = useState<Product[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Product[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});

  const scanCount = userData.scanCount;
  const compareCount = userData.compareList.length;

  useEffect(() => {
    getTrendingProducts(6)
      .then((d) => setTrending(d.map((p) => mapDbProduct(p as unknown as Record<string, unknown>))))
      .catch((e) => console.error("Failed to load trending:", e));
    getWorstRated(4)
      .then((d) => setWorst(d.map((p) => mapDbProduct(p as unknown as Record<string, unknown>))))
      .catch((e) => console.error("Failed to load worst-rated:", e));
    getRecentProducts(4)
      .then((d) => setRecentlyAdded(d.map((p) => mapDbProduct(p as unknown as Record<string, unknown>))))
      .catch((e) => console.error("Failed to load recent:", e));
    fetch("/api/stats")
      .then((r) => r.json())
      .then(({ productCount, flaggedCount, categoryCounts }) => {
        setProductCount(productCount ?? 0);
        setFlaggedCount(flaggedCount ?? 0);
        if (categoryCounts && typeof categoryCounts === "object") {
          setCatCounts(categoryCounts as Record<string, number>);
        }
      })
      .catch(() => {});
  }, []);

  if (!userReady) return null;
  if (!userData.onboarded) {
    return (
      <Onboarding onComplete={async () => {
        await markOnboarded();
        window.dispatchEvent(new Event("sift-onboarded"));
      }} />
    );
  }

  const displayCategories = categories.map((cat) => {
    const dbKeys = Object.entries(categoryMap).filter(([, d]) => d === cat.name).map(([k]) => k);
    return { ...cat, count: dbKeys.reduce((s, k) => s + (catCounts[k] || 0), 0) };
  });

  const editorialIssue = getCurrentIssue();

  return (
    <div className="min-h-dvh" style={{ background: "#F2F2F7" }}>
      <motion.div
        className="pb-32 max-w-lg md:max-w-2xl mx-auto"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {/* ── Hero ── */}
        <motion.div variants={fadeUp} className="px-4 pt-14 pb-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: "#8E8E93" }}>
              {(() => {
                const h = new Date().getHours();
                if (h < 5) return t('greeting_night', language);
                if (h < 12) return t('greeting_morning', language);
                if (h < 17) return t('greeting_afternoon', language);
                return t('greeting_evening', language);
              })()}
            </p>
            {isAnonymous && (
              <Link
                href="/profile"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#007AFF]/20 text-[11px] font-semibold"
                style={{ color: "#007AFF", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              >
                <UserCircle2 size={12} />
                {t('sign_in', language)}
              </Link>
            )}
          </div>
          <h1 className="text-[2.4rem] font-bold leading-[1.05] tracking-[-0.02em] text-black mb-3">
            {language === 'hi' ? (
              <span style={{ color: "#007AFF" }}>{t('hero_title', language)}</span>
            ) : (
              <>Know what&apos;s really<br />
              <span style={{ color: "#007AFF" }}>in your food.</span></>
            )}
          </h1>
          <p className="text-[15px] leading-relaxed mb-6" style={{ color: "#6D6D72" }}>
            {t('hero_subtitle', language)}
          </p>

          {/* Scan CTA */}
          <Link href="/scan">
            <motion.div
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-semibold text-[16px] text-white"
              style={{
                background: "#007AFF",
                boxShadow: "0 8px 24px rgba(0,122,255,0.32), 0 2px 8px rgba(0,122,255,0.16)",
              }}
            >
              <Camera size={20} strokeWidth={2} />
              {t('scan_a_product', language)}
            </motion.div>
          </Link>

          {compareCount > 0 && (
            <Link href="/compare" aria-label={`Compare ${compareCount} products`}>
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 w-full mt-3 py-3 rounded-2xl bg-white border border-[#007AFF]/20 text-[#007AFF] font-semibold text-sm"
              >
                <Scale size={16} />
                {t('compare', language)} {compareCount} {compareCount === 1 ? t('product', language) : t('products', language)}
                <ChevronRight size={14} />
              </motion.div>
            </Link>
          )}
        </motion.div>


        {/* ── Trending ── */}
        {trending.length > 0 && (
          <motion.div variants={fadeUp} className="mb-8">
            <div className="flex items-center justify-between px-4 mb-3">
              <h2 className="text-[17px] font-semibold text-black">{t('trending_scans', language)}</h2>
              <Link href="/search" className="flex items-center gap-0.5 text-[13px] font-medium" style={{ color: "#007AFF" }}>
                {t('see_all', language)} <ChevronRight size={14} />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar scroll-snap-x pb-1 pl-4 pr-4">
              {trending.map((p, i) => {
                const displayCat = categoryMap[p.category] || p.category;
                const catCfg = categoryIconMap[displayCat];
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.35 }}
                    className="shrink-0 scroll-snap-align-start"
                  >
                    <Link href={`/product/${p.id}`}>
                      <motion.div
                        whileTap={{ scale: 0.96 }}
                        className="w-[138px] rounded-2xl bg-white overflow-hidden"
                        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
                      >
                        <div
                          className="h-[52px] flex items-center justify-center"
                          style={{ background: catCfg?.bg || "#F2F2F7" }}
                        >
                          {catCfg
                            ? <catCfg.Icon size={22} color={catCfg.color} />
                            : <Package size={22} color="#8E8E93" />
                          }
                        </div>
                        <div className="p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0 pr-1">
                              <p className="text-[12px] font-semibold text-black truncate leading-tight">{p.name}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: "#8E8E93" }}>{p.brand}</p>
                            </div>
                            <ScoreRing score={p.safety_score} grade={p.grade} size="sm" animate={false} />
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Editorial issue ── */}
        {editorialIssue && (
          <motion.div variants={fadeUp} className="px-4 mb-8">
            <h2 className="text-[17px] font-semibold text-black mb-3">{t('this_week_on_sift', language)}</h2>
            <EditorialCard issue={editorialIssue} />
          </motion.div>
        )}

        {/* ── Worst Rated ── */}
        {worst.length > 0 && (
          <motion.div variants={fadeUp} className="px-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(255,59,48,0.1)" }}>
                <TrendingDown size={11} style={{ color: "#FF3B30" }} />
              </div>
              <h2 className="text-[17px] font-semibold text-black">{t('worst_rated', language)}</h2>
            </div>
            <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              {worst.map((p, i) => {
                const displayCat = categoryMap[p.category] || p.category;
                const catCfg = categoryIconMap[displayCat];
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05, duration: 0.35 }}
                    style={i > 0 ? { borderTop: "0.5px solid rgba(0,0,0,0.07)" } : {}}
                  >
                    <Link href={`/product/${p.id}`}>
                      <motion.div whileTap={{ scale: 0.98 }} className="flex items-center gap-3 px-4 py-3.5">
                        <div className="flex items-center justify-center w-9 h-9 rounded-[10px] shrink-0" style={{ background: catCfg?.bg || "#F2F2F7" }}>
                          {catCfg
                            ? <catCfg.Icon size={16} color={catCfg.color} />
                            : <Package size={16} color="#8E8E93" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-black truncate">{p.name}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "#8E8E93" }}>{p.brand}</p>
                        </div>
                        <ScoreRing score={p.safety_score} grade={p.grade} size="sm" animate={false} />
                      </motion.div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Categories ── */}
        <motion.div variants={fadeUp} className="px-4 mb-8">
          <h2 className="text-[17px] font-semibold text-black mb-3">{t('browse_by_category', language)}</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {displayCategories.map((cat, i) => {
              const cfg = categoryIconMap[cat.name];
              return (
                <Link key={cat.name} href={`/search?category=${cat.name}`}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.04 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-white"
                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
                  >
                    {cfg ? (
                      <div className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ background: cfg.bg }}>
                        <cfg.Icon size={20} color={cfg.color} />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-[12px] flex items-center justify-center" style={{ background: "#F2F2F7" }}>
                        <Package size={20} color="#8E8E93" />
                      </div>
                    )}
                    <p className="text-[12px] font-semibold text-black">{cat.name}</p>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.div>

        {/* ── Recently Added ── */}
        {recentlyAdded.length > 0 && (
          <motion.div variants={fadeUp} className="px-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,122,255,0.1)" }}>
                <Shield size={11} style={{ color: "#007AFF" }} />
              </div>
              <h2 className="text-[17px] font-semibold text-black">{t('recently_added', language)}</h2>
            </div>
            <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              {recentlyAdded.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Footer — Sift Index discovery ── */}
        <motion.div variants={fadeUp} className="px-4 mt-2 mb-2">
          <Link href="/the-index">
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between p-4 rounded-2xl bg-white border border-black/[0.06]"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-1" style={{ color: "#007AFF" }}>The Sift Index</p>
                <p className="text-[14px] font-semibold text-black leading-tight">What India is actually scanning</p>
                <p className="text-[12px] text-black/55 mt-0.5">Honest stats, updated weekly.</p>
              </div>
              <ChevronRight size={18} style={{ color: "#8E8E93" }} />
            </motion.div>
          </Link>
        </motion.div>

        {/* ── Empty state ── */}
        {productCount === 0 && !trending.length && (
          <motion.div variants={fadeUp} className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(0,122,255,0.08)" }}>
              <ShieldAlert size={28} style={{ color: "#007AFF" }} />
            </div>
            <h2 className="text-[18px] font-semibold text-black mb-2">{t('start_scanning', language)}</h2>
            <p className="text-[14px] leading-relaxed max-w-xs mx-auto" style={{ color: "#8E8E93" }}>
              {t('start_scanning_desc', language)}
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
