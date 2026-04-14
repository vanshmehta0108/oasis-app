"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { Camera, ChevronRight, Sparkles, TrendingDown, Zap, Shield, FlaskConical } from "lucide-react";
import { ProductCardHorizontal, ProductCard } from "@/components/ProductCard";
import { ScoreRing } from "@/components/ScoreRing";
import { Onboarding } from "@/components/Onboarding";
import { getTrendingProducts, getWorstRated, categories, products } from "@/lib/mockData";
import { getScanCount } from "@/lib/scanHistory";
import { useRef, useEffect, useState } from "react";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.33, 1, 0.68, 1] as const } },
};

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    const duration = 1200;
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

const categoryIcons: Record<string, string> = {
  Food: "🍚",
  Beverages: "🥤",
  Snacks: "🍿",
  Skincare: "✨",
  Baby: "👶",
  Household: "🏠",
};

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    const onboarded = localStorage.getItem("oasis-onboarded");
    if (!onboarded) {
      setShowOnboarding(true);
    }
    setScanCount(getScanCount());
    setCheckingOnboarding(false);
  }, []);

  const trending = getTrendingProducts();
  const worst = getWorstRated();
  const recentlyAdded = [...products].reverse().slice(0, 4);

  if (checkingOnboarding) return null;
  if (showOnboarding) {
    return (
      <Onboarding
        onComplete={() => {
          localStorage.setItem("oasis-onboarded", "true");
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <div className="gradient-mesh min-h-dvh">
      <motion.div
        className="px-4 pt-12 pb-24 max-w-md sm:max-w-lg mx-auto"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {/* Hero — compact */}
        <motion.div variants={fadeUp} className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-oasis-green/10 flex items-center justify-center">
              <Sparkles size={12} className="text-oasis-green" />
            </div>
            <span className="text-[11px] font-semibold text-oasis-green tracking-wide uppercase">AI-Powered Safety</span>
          </div>
          <h1 className="font-[family-name:var(--font-instrument)] text-[2rem] leading-[1.05] text-oasis-text mb-2">
            Know what&apos;s really<br />
            <span className="text-oasis-green">in your food.</span>
          </h1>
          <p className="text-[13px] text-oasis-muted leading-relaxed max-w-[280px]">
            Scan any Indian product barcode. Get instant AI safety analysis.
          </p>
        </motion.div>

        {/* CTA Button */}
        <motion.div variants={fadeUp} className="mb-6">
          <Link href="/scan">
            <motion.div
              whileTap={{ scale: 0.96 }}
              className="relative flex items-center justify-center gap-3 w-full py-3.5 rounded-2xl bg-oasis-green text-oasis-black font-bold text-[15px] pulse-glow overflow-hidden"
            >
              <Camera size={20} strokeWidth={2.5} />
              Scan a Product
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
            </motion.div>
          </Link>
        </motion.div>

        {/* Stats bar */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="flex items-center justify-between px-1 py-3 rounded-2xl bg-oasis-card/60 border border-oasis-border/50">
            <div className="flex-1 text-center">
              <div className="text-base font-bold text-oasis-green">
                <AnimatedCounter target={products.length * 142} />
              </div>
              <div className="text-[10px] text-oasis-muted mt-0.5">Products</div>
            </div>
            <div className="w-px h-8 bg-oasis-border/50" />
            <div className="flex-1 text-center">
              <div className="text-base font-bold text-oasis-orange">
                <AnimatedCounter target={products.filter(p => p.safety_score < 50).length * 47} />
              </div>
              <div className="text-[10px] text-oasis-muted mt-0.5">Flagged</div>
            </div>
            <div className="w-px h-8 bg-oasis-border/50" />
            <div className="flex-1 text-center">
              <div className="text-base font-bold text-oasis-text">
                <AnimatedCounter target={scanCount + 3420} suffix="+" />
              </div>
              <div className="text-[10px] text-oasis-muted mt-0.5">Scans Today</div>
            </div>
          </div>
        </motion.div>

        {/* Trending Scans */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-oasis-green" />
              <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text">
                Trending Scans
              </h2>
            </div>
            <Link href="/search" className="flex items-center gap-0.5 text-[11px] text-oasis-green font-medium">
              See all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto hide-scrollbar scroll-snap-x pb-1 -mx-1 px-1">
            {trending.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
              >
                <Link href={`/product/${p.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.96 }}
                    className="w-[130px] shrink-0 p-3 rounded-2xl bg-oasis-card border border-oasis-border hover:bg-oasis-card-hover transition-colors relative overflow-hidden"
                  >
                    <div className="text-3xl text-center mb-2">
                      {categoryIcons[p.category] || "📦"}
                    </div>
                    <div className="flex justify-center mb-1.5">
                      <ScoreRing score={p.safety_score} grade={p.grade} size="sm" animate={false} />
                    </div>
                    <h3 className="text-[11px] font-semibold text-oasis-text truncate text-center">
                      {p.name}
                    </h3>
                    <p className="text-[10px] text-oasis-muted text-center mt-0.5">
                      {p.brand}
                    </p>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Worst Rated — dramatic red tint */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-oasis-red" />
              <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text">
                Worst Rated This Week
              </h2>
            </div>
          </div>
          <div className="space-y-2">
            {worst.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.06, duration: 0.4 }}
              >
                <Link href={`/product/${p.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-red-950/20 border border-red-400/10 hover:border-red-400/20 transition-all relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/[0.04] to-transparent pointer-events-none" />
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-400/10 text-lg shrink-0">
                      {categoryIcons[p.category] || "📦"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[13px] font-semibold text-oasis-text truncate">{p.name}</h3>
                      <p className="text-[11px] text-oasis-muted">{p.brand}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-red-400">{p.safety_score}</span>
                      <div className="w-8 h-8 rounded-full border-2 border-red-400/30 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-red-400">{p.grade}</span>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Categories */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="flex items-center gap-2 mb-2.5">
            <FlaskConical size={14} className="text-oasis-green" />
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text">
              Categories
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((cat, i) => (
              <Link key={cat.name} href={`/search?category=${cat.name}`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.05, duration: 0.3 }}
                  whileTap={{ scale: 0.93 }}
                  whileHover={{ borderColor: "rgba(74,222,128,0.3)" }}
                  className="flex flex-col items-center gap-1 p-3 rounded-2xl bg-oasis-card border border-oasis-border transition-colors"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-[11px] font-semibold text-oasis-text">{cat.name}</span>
                  <span className="text-[9px] text-oasis-muted">{cat.count} items</span>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recently Added */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-2 mb-2.5">
            <Shield size={14} className="text-oasis-green" />
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text">
              Recently Added
            </h2>
          </div>
          <div className="space-y-2">
            {recentlyAdded.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
