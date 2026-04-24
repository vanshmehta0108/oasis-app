"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import {
  Camera, ChevronRight, TrendingDown, Shield, ShieldAlert,
  UtensilsCrossed, Coffee, Popcorn, Sparkles, Baby, Home as HomeIcon, Package
} from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ScoreRing } from "@/components/ScoreRing";
import { Onboarding } from "@/components/Onboarding";
import { categories } from "@/lib/mockData";
import type { Product } from "@/lib/mockData";
import { getTrendingProducts, getWorstRated, getRecentProducts, getProductCount, getFlaggedCount, getCategoryCounts } from "@/lib/db";
import { getScanCount } from "@/lib/scanHistory";
import { useRef, useEffect, useState } from "react";

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
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
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
  }, [inView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// Lucide icons for categories — no more emojis
const categoryIconMap: Record<string, { Icon: React.ElementType; bg: string; color: string }> = {
  Food:      { Icon: UtensilsCrossed, bg: "#FFF3E8", color: "#FF6B00" },
  Beverages: { Icon: Coffee,          bg: "#EBF3FF", color: "#007AFF" },
  Snacks:    { Icon: Popcorn,         bg: "#FFF8E6", color: "#B87800" },
  Skincare:  { Icon: Sparkles,        bg: "#F5EEFF", color: "#8B5CF6" },
  Baby:      { Icon: Baby,            bg: "#FFF0F5", color: "#FF2D78" },
  Household: { Icon: HomeIcon,        bg: "#F0FBF4", color: "#1E8040" },
};

// Fallback icon for unknown categories
function CategoryIcon({ category, size = 18 }: { category: string; size?: number }) {
  const cfg = categoryIconMap[category];
  if (!cfg) {
    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-[10px] shrink-0" style={{ background: "#F2F2F7" }}>
        <Package size={size} color="#8E8E93" />
      </div>
    );
  }
  const { Icon, bg, color } = cfg;
  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-[10px] shrink-0" style={{ background: bg }}>
      <Icon size={size} color={color} />
    </div>
  );
}

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

// Normalize DB category keys to display names
const categoryMap: Record<string, string> = {
  food: "Food", beverage: "Beverages", snack: "Snacks",
  skincare: "Skincare", baby_food: "Baby", household: "Household",
};

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [scanCount, setScanCount] = useState(0);
  const [trending, setTrending] = useState<Product[]>([]);
  const [worst, setWorst] = useState<Product[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Product[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const onboarded = localStorage.getItem("oasis-onboarded");
    if (!onboarded) setShowOnboarding(true);
    setScanCount(getScanCount());
    setCheckingOnboarding(false);
    getTrendingProducts(6)
      .then((d) => setTrending(d.map((p) => mapDbProduct(p as unknown as Record<string, unknown>))))
      .catch((e) => console.error("Failed to load trending:", e));
    getWorstRated(4)
      .then((d) => setWorst(d.map((p) => mapDbProduct(p as unknown as Record<string, unknown>))))
      .catch((e) => console.error("Failed to load worst-rated:", e));
    getRecentProducts(4)
      .then((d) => setRecentlyAdded(d.map((p) => mapDbProduct(p as unknown as Record<string, unknown>))))
      .catch((e) => console.error("Failed to load recent:", e));
    getProductCount().then(setProductCount).catch(() => setProductCount(0));
    getFlaggedCount().then(setFlaggedCount).catch(() => setFlaggedCount(0));
    getCategoryCounts().then(setCatCounts).catch(() => setCatCounts({}));
  }, []);

  if (checkingOnboarding) return null;
  if (showOnboarding) {
    return (
      <Onboarding onComplete={() => {
        localStorage.setItem("oasis-onboarded", "true");
        window.dispatchEvent(new Event("sift-onboarded"));
        setShowOnboarding(false);
      }} />
    );
  }

  const displayCategories = categories.map((cat) => {
    const dbKeys = Object.entries(categoryMap).filter(([, d]) => d === cat.name).map(([k]) => k);
    return { ...cat, count: dbKeys.reduce((s, k) => s + (catCounts[k] || 0), 0) };
  });

  return (
    <div className="min-h-dvh" style={{ background: "#F2F2F7" }}>
      <motion.div
        className="pb-32 max-w-lg mx-auto"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {/* ── Hero ── */}
        <motion.div variants={fadeUp} className="px-4 pt-14 pb-6">
          {/* Wordmark */}
          <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-5" style={{ color: "#8E8E93" }}>
            Sift — AI Food Safety
          </p>
          <h1 className="text-[2.4rem] font-bold leading-[1.05] tracking-[-0.02em] text-black mb-3">
            Know what&apos;s really<br />
            <span style={{ color: "#007AFF" }}>in your food.</span>
          </h1>
          <p className="text-[15px] leading-relaxed mb-6" style={{ color: "#6D6D72" }}>
            Scan any Indian product barcode for instant AI safety analysis and ingredient breakdown.
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
              Scan a Product
            </motion.div>
          </Link>
        </motion.div>

        {/* ── Stats ── */}
        <motion.div variants={fadeUp} className="px-4 mb-8">
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div className="grid grid-cols-3">
              {[
                { label: "Products Analyzed", value: <AnimatedCounter target={productCount || 0} />, color: "#007AFF", border: true },
                { label: "Flagged Unsafe",    value: <AnimatedCounter target={flaggedCount || 0} />,  color: "#FF3B30", border: true },
                { label: "Total Scans",       value: <AnimatedCounter target={scanCount} suffix="+" />, color: "#1C1C1E", border: false },
              ].map(({ label, value, color, border }) => (
                <div
                  key={label}
                  className="flex flex-col items-center py-5 px-2"
                  style={border ? { borderRight: "0.5px solid rgba(0,0,0,0.08)" } : {}}
                >
                  <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color }}>{value}</span>
                  <span className="text-[10px] font-medium mt-1.5 text-center leading-tight" style={{ color: "#8E8E93" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Trending ── */}
        {trending.length > 0 && (
          <motion.div variants={fadeUp} className="mb-8">
            <div className="flex items-center justify-between px-4 mb-3">
              <h2 className="text-[17px] font-semibold text-black">Trending Scans</h2>
              <Link href="/search" className="flex items-center gap-0.5 text-[13px] font-medium" style={{ color: "#007AFF" }}>
                See all <ChevronRight size={14} />
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
                        {/* Color header */}
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

        {/* ── Worst Rated ── */}
        {worst.length > 0 && (
          <motion.div variants={fadeUp} className="px-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(255,59,48,0.1)" }}>
                <TrendingDown size={11} style={{ color: "#FF3B30" }} />
              </div>
              <h2 className="text-[17px] font-semibold text-black">Worst Rated This Week</h2>
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
          <h2 className="text-[17px] font-semibold text-black mb-3">Browse by Category</h2>
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
                    <div className="text-center">
                      <p className="text-[12px] font-semibold text-black">{cat.name}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#8E8E93" }}>{cat.count} items</p>
                    </div>
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
              <h2 className="text-[17px] font-semibold text-black">Recently Added</h2>
            </div>
            <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              {recentlyAdded.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Empty state ── */}
        {productCount === 0 && !trending.length && (
          <motion.div variants={fadeUp} className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(0,122,255,0.08)" }}>
              <ShieldAlert size={28} style={{ color: "#007AFF" }} />
            </div>
            <h2 className="text-[18px] font-semibold text-black mb-2">Start Scanning</h2>
            <p className="text-[14px] leading-relaxed max-w-xs mx-auto" style={{ color: "#8E8E93" }}>
              Scan your first product barcode to build your safety database.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
