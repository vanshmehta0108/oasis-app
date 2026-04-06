"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, Leaf, Share2, ShieldAlert, Heart, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/lib/useToast";
import { ScoreRing } from "@/components/ScoreRing";
import { IngredientList } from "@/components/IngredientList";
import { getProductById, type Product as MockProduct, type IngredientAnalysis } from "@/lib/mockData";

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

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.33, 1, 0.68, 1] as const } },
};

function mapMockToProductData(p: MockProduct): ProductData {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    ingredients: p.ingredients,
    safety_score: p.safety_score,
    grade: p.grade,
    image_url: p.image_url,
    analysis: p.analysis,
  };
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    // Try mock data first
    const mockProduct = getProductById(id);
    if (mockProduct) {
      setProduct(mapMockToProductData(mockProduct));
      return;
    }

    // Check sessionStorage for OFF product
    if (id.startsWith("off-")) {
      const barcode = id.replace("off-", "");
      const stored = sessionStorage.getItem(`off-product-${barcode}`);
      if (stored) {
        const data = JSON.parse(stored);
        setProduct({
          id: data.id,
          name: data.name,
          brand: data.brand,
          category: data.category,
          ingredients: data.ingredients || [],
          safety_score: data.safety_score || null,
          grade: data.grade || null,
          image_url: data.image_url,
          analysis: data.analysis,
        });

        // If it needs analysis and has ingredients, trigger AI analysis
        if (data.needs_analysis && data.ingredients?.length > 0) {
          setAnalyzing(true);
          fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ingredients: data.ingredients, category: data.category || "food" }),
          })
            .then((res) => res.ok ? res.json() : null)
            .then((result) => {
              if (result?.analysis) {
                setProduct((prev) =>
                  prev
                    ? {
                        ...prev,
                        safety_score: result.analysis.score,
                        grade: result.analysis.grade,
                        analysis: {
                          summary: result.analysis.summary,
                          ingredients: result.analysis.ingredients,
                          warnings: result.analysis.warnings,
                          healthier_alternative: result.analysis.healthier_tip,
                        },
                      }
                    : prev
                );
              }
            })
            .catch(console.error)
            .finally(() => setAnalyzing(false));
        }
        return;
      }
    }

    setNotFoundState(true);
  }, [id]);

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
      <div className="flex items-center justify-center min-h-dvh gradient-mesh">
        <Loader2 size={32} className="text-oasis-green animate-spin" />
      </div>
    );
  }

  const { showToast } = useToast();
  const hasScore = product.safety_score !== null && product.grade !== null;
  const score = product.safety_score ?? 0;
  const grade = product.grade ?? "?";
  const level = getSummaryLevel(score);
  const scoreColor = hasScore ? getScoreColor(score) : "#6b7c72";

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

        {/* Share button */}
        <motion.div variants={fadeUp} className="px-5 mb-4">
          <motion.button
            whileTap={{ scale: 0.96 }}
            aria-label="Share this product score"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `${product.name} — Safety Score: ${score}/100`,
                  text: `I scanned ${product.name} on Oasis. It scored ${score}/100 (Grade ${grade}). ${product.analysis?.summary || ""}`,
                  url: window.location.href,
                }).then(() => {
                  showToast("Score shared!", "success");
                }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(window.location.href).then(() => {
                  showToast("Link copied to clipboard!", "success");
                }).catch(() => {});
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-oasis-card border border-oasis-border hover:bg-oasis-card-hover transition-colors"
          >
            <Share2 size={15} className="text-oasis-green" />
            <span className="text-sm font-medium text-oasis-text">Share This Score</span>
          </motion.button>
        </motion.div>

        {/* Summary card with colored left border */}
        {product.analysis && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <div className={`flex items-start gap-3 p-4 rounded-2xl ${level.bg} border border-white/5 border-l-[3px] ${level.border}`}>
              <ShieldAlert size={20} className={`${level.color} shrink-0 mt-0.5`} />
              <div>
                <span className={`text-sm font-bold ${level.color}`}>
                  Overall: {level.label}
                </span>
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
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text mb-3">
              Ingredients
            </h2>
            <div className="p-4 rounded-2xl bg-oasis-card border border-oasis-border">
              <p className="text-xs text-oasis-text-secondary leading-relaxed">
                {product.ingredients.join(", ")}
              </p>
              {!analyzing && (
                <p className="text-[11px] text-oasis-muted mt-3">
                  AI analysis unavailable — set your Anthropic API key to enable safety scoring.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Ingredient Analysis */}
        {product.analysis && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text mb-3">
              Ingredient Analysis
            </h2>
            <IngredientList ingredients={product.analysis.ingredients} />
          </motion.div>
        )}

        {/* Warnings */}
        {product.analysis && product.analysis.warnings.length > 0 && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text mb-3">
              Warnings
            </h2>
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
              <Link
                href="/profile"
                className="inline-block text-xs text-oasis-green font-medium mt-2"
              >
                Set up profile &rarr;
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
