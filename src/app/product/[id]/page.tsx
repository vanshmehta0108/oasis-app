"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, Leaf, Share2, ShieldAlert, Heart, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/lib/useToast";
import { SkeletonScoreHero, SkeletonLine } from "@/components/Skeleton";
import { ScoreRing } from "@/components/ScoreRing";
import { IngredientList } from "@/components/IngredientList";
import type { IngredientAnalysis } from "@/lib/mockData";
import { getProductByBarcode as getDbProduct } from "@/lib/db";
import { recordScan } from "@/lib/scanHistory";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProductData {
  id: string;
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  safety_score: number | null;
  grade: string | null;
  image_url?: string;
  analysis?: {
    summary: string;
    ingredients: IngredientAnalysis[];
    warnings: string[];
    healthier_alternative: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getSummaryLevel(score: number) {
  if (score >= 75) return { label: "Safe", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-l-emerald-400" };
  if (score >= 55) return { label: "Moderate", color: "text-lime-400", bg: "bg-lime-400/10", border: "border-l-lime-400" };
  if (score >= 35) return { label: "Concerning", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-l-amber-400" };
  return { label: "Unsafe", color: "text-red-400", bg: "bg-red-400/10", border: "border-l-red-400" };
}

function getScoreColor(score: number) {
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#a3e635";
  if (score >= 40) return "#fbbf24";
  if (score >= 20) return "#fb923c";
  return "#f87171";
}

function mapAnalysisJson(analysis: Record<string, unknown>): ProductData["analysis"] {
  const rawIngredients = (analysis.ingredients as Array<{
    name: string;
    risk?: string;
    risk_level?: string;
    explanation: string;
  }>) || [];

  return {
    summary: (analysis.summary as string) || "",
    ingredients: rawIngredients.map((ing) => ({
      name: ing.name,
      risk: (ing.risk || ing.risk_level || "caution") as IngredientAnalysis["risk"],
      explanation: ing.explanation,
    })),
    warnings: (analysis.warnings as string[]) || [],
    healthier_alternative:
      (analysis.healthier_alternative as string) ||
      (analysis.healthier_tip as string) ||
      "",
  };
}

function mapRawToProduct(data: Record<string, unknown>): ProductData {
  return {
    id: (data.id as string) || "",
    name: (data.name as string) || "",
    brand: (data.brand as string) || "",
    category: (data.category as string) || "",
    ingredients: (data.ingredients as string[]) || [],
    safety_score: (data.safety_score as number) ?? null,
    grade: (data.grade as string) ?? null,
    image_url: data.image_url as string | undefined,
    analysis: data.analysis as ProductData["analysis"] | undefined,
  };
}

// ── Animation ──────────────────────────────────────────────────────────────────

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.33, 1, 0.68, 1] as const } },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [notFoundState, setNotFoundState] = useState(false);
  const { showToast } = useToast();

  const score = product?.safety_score ?? 0;
  const grade = product?.grade ?? "?";
  const hasScore = product?.safety_score != null && product?.grade != null;
  const level = getSummaryLevel(score);
  const scoreColor = hasScore ? getScoreColor(score) : "#6b7c72";

  // Dynamic OG meta tags
  useEffect(() => {
    if (!product) return;
    document.title = `${product.name} — ${score}/100 | Oasis`;

    const setMeta = (prop: string, content: string) => {
      let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", prop);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    const shareUrl = `${window.location.origin}/api/share?name=${encodeURIComponent(product.name)}&brand=${encodeURIComponent(product.brand)}&score=${score}&grade=${grade}`;
    setMeta("og:title", `${product.name} — Safety Score: ${score}/100`);
    setMeta("og:description", product.analysis?.summary || `Scanned on Oasis. Grade ${grade}.`);
    setMeta("og:image", shareUrl);
    setMeta("og:type", "article");
  }, [product, score, grade]);

  // Trigger AI analysis for unscored products
  function runAnalysis(ingredients: string[], category: string) {
    setAnalyzing(true);
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients, category: category || "food" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result) => {
        if (!result?.analysis) return;
        setProduct((prev) =>
          prev
            ? {
                ...prev,
                safety_score: result.analysis.score,
                grade: result.analysis.grade,
                analysis: mapAnalysisJson(result.analysis),
              }
            : prev,
        );
      })
      .catch(console.error)
      .finally(() => setAnalyzing(false));
  }

  // Main data loader
  useEffect(() => {
    // 1. Try Supabase DB first
    getDbProduct(id)
      .then((dbProduct) => {
        if (!dbProduct) return null;

        const analysis = dbProduct.analysis as unknown as Record<string, unknown> | null;
        setProduct({
          id: dbProduct.barcode,
          name: dbProduct.name,
          brand: dbProduct.brand,
          category: dbProduct.category as string,
          ingredients: dbProduct.ingredients,
          safety_score: dbProduct.safety_score,
          grade: dbProduct.score_grade,
          image_url: dbProduct.image_url || undefined,
          analysis: analysis ? mapAnalysisJson(analysis) : undefined,
        });
        recordScan({
          id: dbProduct.barcode,
          name: dbProduct.name,
          brand: dbProduct.brand,
          category: dbProduct.category as string,
        });
        return dbProduct; // signal found
      })
      .then((found) => {
        if (found) return;
        // 2. Not in DB — try external sources
        loadExternal(id);
      })
      .catch(() => {
        loadExternal(id);
      });

    function loadExternal(productId: string) {
      // OFF products
      if (productId.startsWith("off-")) {
        const barcode = productId.replace("off-", "");
        const stored = sessionStorage.getItem(`off-product-${barcode}`);

        if (stored) {
          const data = JSON.parse(stored);
          setProduct(mapRawToProduct(data));
          recordScan(data);
          if (data.needs_analysis && data.ingredients?.length > 0) {
            runAnalysis(data.ingredients, data.category);
          }
          return;
        }

        // Fetch from lookup API
        fetch("/api/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.found && data.product) {
              setProduct(mapRawToProduct(data.product));
              recordScan(data.product);
              if (data.needs_analysis && data.product.ingredients?.length > 0) {
                runAnalysis(data.product.ingredients, data.product.category);
              }
            } else {
              setNotFoundState(true);
            }
          })
          .catch(() => setNotFoundState(true));
        return;
      }

      // Web-enriched products
      if (productId.startsWith("web-")) {
        const barcode = productId.replace("web-", "");
        const stored = sessionStorage.getItem(`web-product-${barcode}`);
        if (stored) {
          const data = JSON.parse(stored);
          setProduct(mapRawToProduct({ ...data, id: data.id || productId }));
          recordScan(data);
          if (data.needs_analysis && data.ingredients?.length > 0) {
            runAnalysis(data.ingredients, data.category);
          }
          return;
        }
      }

      // Analyzed products from photo scan
      const analyzedData = sessionStorage.getItem(`analyzed-${productId}`);
      if (analyzedData) {
        const data = JSON.parse(analyzedData);
        setProduct(mapRawToProduct(data));
        recordScan(data);
        return;
      }

      setNotFoundState(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (notFoundState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gradient-mesh px-6">
        <h1 className="text-xl font-bold text-oasis-text mb-2">Product Not Found</h1>
        <p className="text-sm text-oasis-muted text-center mb-4">This product isn&apos;t in our database yet.</p>
        <Link href="/scan" className="px-5 py-2.5 rounded-full bg-oasis-green text-oasis-black font-bold text-sm">
          Scan Another
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-dvh gradient-mesh">
        <div className="max-w-lg mx-auto">
          <SkeletonScoreHero />
          <div className="px-5 space-y-3">
            <SkeletonLine width="100%" height="80px" />
            <SkeletonLine width="100%" height="60px" />
            <SkeletonLine width="100%" height="60px" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh relative">
      {/* Score halo background */}
      <div
        className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${scoreColor}10 0%, transparent 70%)`,
        }}
      />

      {/* Floating back button */}
      <div className="fixed top-4 left-4 z-50">
        <Link href="/" aria-label="Go back to home page">
          <motion.div
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-full glass-dark border border-white/10 focus-visible:ring-2 focus-visible:ring-oasis-green"
          >
            <ArrowLeft size={16} className="text-oasis-text" aria-hidden="true" />
            <span className="text-xs font-medium text-oasis-text">Back</span>
          </motion.div>
        </Link>
      </div>

      <motion.div
        className="max-w-lg mx-auto pb-8 relative"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {/* AI Analyzing Banner */}
        {analyzing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-5 mt-14 mb-2 flex items-center gap-3 p-3 rounded-xl bg-oasis-green/10 border border-oasis-green/20"
          >
            <Loader2 size={16} className="text-oasis-green animate-spin shrink-0" />
            <p className="text-xs text-oasis-green font-medium">AI is analyzing ingredients... This may take a few seconds.</p>
          </motion.div>
        )}

        {/* Score Hero */}
        <motion.div
          variants={fadeUp}
          className={`flex flex-col items-center px-5 ${analyzing ? "pt-4" : "pt-20"} pb-5`}
        >
          {hasScore ? (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 18, delay: 0.1 }}
            >
              <ScoreRing score={score} grade={grade} size="lg" />
            </motion.div>
          ) : (
            <div className="w-[168px] h-[168px] rounded-full bg-oasis-card border-2 border-oasis-border flex items-center justify-center">
              {analyzing ? (
                <Loader2 size={40} className="text-oasis-green animate-spin" />
              ) : (
                <span className="text-3xl text-oasis-muted">?</span>
              )}
            </div>
          )}
          <motion.h1
            variants={fadeUp}
            className="text-xl font-bold text-oasis-text text-center mt-4"
          >
            {product.name}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-sm text-oasis-muted mt-1">
            {product.brand}
          </motion.p>
          <motion.span
            variants={fadeUp}
            className="inline-block text-[11px] px-3 py-1 mt-2 rounded-full bg-oasis-green/10 text-oasis-green font-medium"
          >
            {product.category}
          </motion.span>
        </motion.div>

        {/* Share buttons */}
        <motion.div variants={fadeUp} className="px-5 mb-4">
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                const text = `I scanned ${product.name} on Oasis — it scored ${score}/100 (Grade ${grade}). ${level.label}! 🌿\n\nScan your products: ${window.location.origin}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span className="text-sm font-medium text-[#25D366]">WhatsApp</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `${product.name} — Safety Score: ${score}/100`,
                    text: `I scanned ${product.name} on Oasis. It scored ${score}/100 (Grade ${grade}). ${product.analysis?.summary || ""}`,
                    url: window.location.href,
                  }).catch(() => {});
                } else {
                  navigator.clipboard?.writeText(window.location.href).then(() => {
                    showToast("Link copied!", "success");
                  }).catch(() => {});
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-oasis-card border border-oasis-border hover:bg-oasis-card-hover transition-colors"
            >
              <Share2 size={15} className="text-oasis-green" />
              <span className="text-sm font-medium text-oasis-text">Share</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Summary card */}
        {product.analysis && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <div className={`flex items-start gap-3 p-4 rounded-2xl ${level.bg} border border-white/5 border-l-[3px] ${level.border}`}>
              <ShieldAlert size={20} className={`${level.color} shrink-0 mt-0.5`} />
              <div>
                <span className={`text-sm font-bold ${level.color}`}>Overall: {level.label}</span>
                <p className="text-xs text-oasis-text-secondary leading-relaxed mt-1">
                  {product.analysis.summary}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Raw Ingredients (when no analysis yet) */}
        {!product.analysis && product.ingredients.length > 0 && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text mb-3">Ingredients</h2>
            <div className="p-4 rounded-2xl bg-oasis-card border border-oasis-border">
              <p className="text-xs text-oasis-text-secondary leading-relaxed">
                {product.ingredients.join(", ")}
              </p>
              {!analyzing && (
                <p className="text-[11px] text-oasis-muted mt-3">
                  AI analysis unavailable — set your Google AI API key to enable safety scoring.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Ingredient Analysis */}
        {product.analysis && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text mb-3">Ingredient Analysis</h2>
            <IngredientList ingredients={product.analysis.ingredients} />
          </motion.div>
        )}

        {/* Warnings */}
        {product.analysis && product.analysis.warnings.length > 0 && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text mb-3">Warnings</h2>
            <div className="space-y-2">
              {product.analysis.warnings.map((w, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-red-400/5 border border-red-400/10 warning-pulse"
                >
                  <div className="w-5 h-5 rounded-full bg-red-400/10 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle size={11} className="text-red-400" />
                  </div>
                  <p className="text-xs text-red-300/90 leading-relaxed">{w}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Healthier Alternative */}
        {product.analysis?.healthier_alternative && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-400/5 border border-emerald-400/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/[0.03] to-transparent pointer-events-none" />
              <Leaf size={20} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-bold text-emerald-400">Healthier Alternative</span>
                <p className="text-xs text-oasis-text-secondary leading-relaxed mt-1">
                  {product.analysis.healthier_alternative}
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-semibold"
                >
                  <ExternalLink size={12} />
                  Shop Now
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Personalized note */}
        <motion.div variants={fadeUp} className="px-5">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-oasis-card border border-oasis-border">
            <Heart size={18} className="text-oasis-green shrink-0 mt-0.5" />
            <div>
              <span className="text-sm font-semibold text-oasis-text">Personalized Insights</span>
              <p className="text-xs text-oasis-muted leading-relaxed mt-1">
                Set up your health profile to get warnings tailored to your conditions, allergies, and dietary preferences.
              </p>
              <Link href="/profile" className="inline-block text-xs text-oasis-green font-medium mt-2">
                Set up profile &rarr;
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
