"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, Leaf, Share2, ShieldAlert, Heart, ExternalLink, Loader2, BadgeCheck, BadgeX, Camera, UserCircle, Scale, Check, Flag, Sparkles, Package, Info, Bookmark, BookmarkCheck, ChevronRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/lib/useToast";
import { SkeletonScoreHero, SkeletonLine } from "@/components/Skeleton";
import { ScoreRing } from "@/components/ScoreRing";
import { IngredientList } from "@/components/IngredientList";
import type { IngredientAnalysis } from "@/lib/mockData";
import { masterLookup } from "@/lib/master";
import { getProductByBarcode as getDbProduct, getTopRatedInCategory } from "@/lib/db";
import { ProductCardHorizontal } from "@/components/ProductCard";
import type { Product } from "@/lib/mockData";
import { useUserData, hasPersonalization, LIMITS } from "@/lib/userData";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";
import { BuyOnline } from "@/components/BuyOnline";

interface PersonalWarning {
  warning: string;
  severity: "info" | "moderate" | "serious";
  related_condition: string;
  triggering_ingredient: string;
}

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
  fssai_license?: string | null;
  barcode?: string | null;
  nutritional_info?: Record<string, unknown> | null;
  analysis?: {
    summary: string;
    ingredients: IngredientAnalysis[];
    warnings: string[];
    healthier_alternative: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getSummaryLevel(score: number) {
  if (score >= 75) return { label: "Safe", color: "text-[#1E8040]", bg: "bg-[#F0FBF4]", border: "border-l-[#1E8040]" };
  if (score >= 55) return { label: "Moderate", color: "text-[#B87800]", bg: "bg-[#FFF8E6]", border: "border-l-[#B87800]" };
  if (score >= 35) return { label: "Concerning", color: "text-[#CC5200]", bg: "bg-[#FFF2E8]", border: "border-l-[#CC5200]" };
  return { label: "Unsafe", color: "text-[#CC1010]", bg: "bg-[#FFF0EE]", border: "border-l-[#CC1010]" };
}

function getScoreColor(score: number) {
  if (score >= 80) return "#34C759";
  if (score >= 60) return "#FF9F0A";
  if (score >= 40) return "#FF6B00";
  if (score >= 20) return "#FF3B30";
  return "#FF3B30";
}

// Returns true only when the array looks like real ingredient names, not a
// nutritional-panel OCR dump (numbers, RDA%, serving sizes, marketing copy).
function hasCleanIngredients(ingredients: string[]): boolean {
  if (ingredients.length === 0) return false;
  const combined = ingredients.join(" ");
  // Flag nutritional / label-dump keywords
  const dump = /serving|kcal|kj|rda|nutritional|energy|carbohydrate|cholesterol|sodium|potassium|calcium|magnes|protein|per\s*\d+\s*(?:ml|g)|uom|approx|values\s*facts|\d{2,}\.\d+/i;
  if (dump.test(combined)) return false;
  // Any single token longer than 80 chars is a sentence, not an ingredient name
  if (ingredients.some((s) => s.trim().length > 80)) return false;
  return true;
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
    grade: (data.grade as string) ?? (data.score_grade as string) ?? null,
    image_url: data.image_url as string | undefined,
    fssai_license: (data.fssai_license as string | null) ?? null,
    barcode: (data.barcode as string | null) ?? null,
    nutritional_info: (data.nutritional_info as Record<string, unknown> | null) ?? null,
    analysis: data.analysis
      ? mapAnalysisJson(data.analysis as Record<string, unknown>)
      : undefined,
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

export default function ProductClient({ id, initialProduct }: { id: string; initialProduct?: Record<string, unknown> | null }) {
  const [product, setProduct] = useState<ProductData | null>(
    initialProduct ? mapRawToProduct(initialProduct) : null
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingMessage, setAnalyzingMessage] = useState("AI is analysing ingredients…");
  const [labelScanning, setLabelScanning] = useState(false);
  const [notFoundState, setNotFoundState] = useState(false);
  const [personalWarnings, setPersonalWarnings] = useState<PersonalWarning[] | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showOtherInfo, setShowOtherInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const {
    data: userData,
    recordScan,
    addToCompare,
    removeFromCompare,
    toggleBookmark,
  } = useUserData();

  const { language } = useLanguage();
  const inCompare = userData.compareList.some((c) => c.id === (product?.id ?? ""));
  const isBookmarked = userData.bookmarks.some((b) => b.id === (product?.id ?? ""));
  const lang: "en" | "hi" = userData.profile.language === "Hindi" ? "hi" : "en";
  // Tracks the language the currently-displayed analysis was rendered in,
  // so we don't re-translate on every render.
  const [analysisLang, setAnalysisLang] = useState<"en" | "hi">("en");
  const [topRated, setTopRated] = useState<Product[]>([]);

  const score = product?.safety_score ?? 0;
  const grade = product?.grade ?? "?";
  const hasScore = product?.safety_score != null && product?.grade != null;
  const level = getSummaryLevel(score);
  const scoreColor = hasScore ? getScoreColor(score) : "#6b7c72";

  const ingredientCounts = (() => {
    const list = product?.analysis?.ingredients ?? [];
    let harmful = 0; let beneficial = 0;
    for (const ing of list) {
      if (["danger", "warning", "caution"].includes(ing.risk)) harmful++;
      else if (ing.risk === "safe") beneficial++;
    }
    return { harmful, beneficial };
  })();

  // Dynamic OG meta tags
  useEffect(() => {
    if (!product) return;
    // For unscored products score falls back to 0 — don't render that as
    // "0/100" in the page title or share metadata since 0 is a real
    // (worst-case) score; show the product name only and let the share
    // image renderer handle the no-score state.
    document.title = hasScore ? `${product.name} — ${score}/100 | Sift` : `${product.name} | Sift`;

    const setMeta = (prop: string, content: string) => {
      let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", prop);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    const shareUrl = hasScore
      ? `${window.location.origin}/api/share?name=${encodeURIComponent(product.name)}&brand=${encodeURIComponent(product.brand)}&score=${score}&grade=${grade}`
      : `${window.location.origin}/api/share?name=${encodeURIComponent(product.name)}&brand=${encodeURIComponent(product.brand)}`;
    setMeta("og:title", hasScore ? `${product.name} — Safety Score: ${score}/100` : product.name);
    setMeta("og:description", product.analysis?.summary || (hasScore ? `Scanned on Sift. Grade ${grade}.` : "Scanned on Sift."));
    setMeta("og:image", shareUrl);
    setMeta("og:type", "article");
  }, [product, score, grade, hasScore]);

  // Guards against late responses writing state for a product the user has
  // already navigated away from. Bumped on each id change by the loader effect.
  const loaderGen = useRef(0);

  // Reads a text/event-stream response and calls onEvent for each parsed SSE event.
  async function readSSE(
    res: Response,
    gen: number,
    onEvent: (data: Record<string, unknown>) => void,
  ) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || gen !== loaderGen.current) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            onEvent(JSON.parse(line.slice(6)) as Record<string, unknown>);
          } catch { /* ignore malformed lines */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Trigger AI analysis for unscored products
  function runAnalysis(ingredients: string[], category: string, barcode?: string) {
    setAnalyzing(true);
    setAnalyzingMessage("Checking database…");
    const gen = loaderGen.current;
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients, category: category || "food", lang, ...(barcode ? { barcode } : {}) }),
    })
      .then(async (res) => {
        if (!res.ok) { console.error("analyze failed", res.status); return; }
        await readSSE(res, gen, (data) => {
          if (data.type === "progress" && typeof data.message === "string") {
            setAnalyzingMessage(data.message);
          } else if (data.type === "complete") {
            if (gen !== loaderGen.current) return;
            const result = data as Record<string, unknown>;
            if (!result.analysis) return;
            const analysis = result.analysis as Record<string, unknown>;
            setProduct((prev) =>
              prev
                ? { ...prev, safety_score: analysis.score as number, grade: analysis.grade as string, analysis: mapAnalysisJson(analysis) }
                : prev,
            );
            if (data.lang) setAnalysisLang(data.lang === "hi" ? "hi" : "en");
          }
        });
      })
      .catch(console.error)
      .finally(() => {
        if (gen === loaderGen.current) setAnalyzing(false);
      });
  }

  // Scan ingredient label photo → real-time OCR + AI analysis
  function scanLabel(file: File) {
    setLabelScanning(true);
    const gen = loaderGen.current;
    const reader = new FileReader();
    const finish = () => {
      if (gen === loaderGen.current) setLabelScanning(false);
    };
    reader.onerror = () => {
      finish();
      showToast("Couldn't read the image file — please try again", "error");
    };
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.includes(",")) {
        finish();
        showToast("Image couldn't be processed — try a different photo", "error");
        return;
      }
      const base64 = result.split(",")[1];
      const barcode = id.startsWith("off-") ? id.replace("off-", "") : id.startsWith("web-") ? id.replace("web-", "") : id;
      fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          barcode: barcode.startsWith("analyzed-") || barcode.startsWith("manual-") ? undefined : barcode,
          name: product?.name,
          brand: product?.brand,
          category: product?.category || "food",
          lang,
        }),
      })
        .then(async (res) => {
          if (!res.ok) { showToast("Label scan failed — please try again", "error"); return; }
          let gotResult = false;
          await readSSE(res, gen, (data) => {
            if (data.type === "progress" && typeof data.message === "string") {
              // label scanning has its own spinner copy, no need to update message
            } else if (data.type === "complete") {
              if (gen !== loaderGen.current) return;
              const payload = data as Record<string, unknown>;
              if (!payload.analysis) {
                showToast("Couldn't read the label — try better lighting or a closer shot", "error");
                return;
              }
              gotResult = true;
              const analysis = payload.analysis as Record<string, unknown>;
              const label = payload.label_extraction as Record<string, unknown> | null;
              setNotFoundState(false);
              setProduct((prev) => ({
                id,
                name: prev?.name || (label?.product_name as string) || "Unknown Product",
                brand: prev?.brand || (label?.brand as string) || "Unknown Brand",
                category: prev?.category || (label?.category_guess as string) || "food",
                ingredients: (label?.ingredients as string[] | undefined)?.length ? (label!.ingredients as string[]) : (prev?.ingredients ?? []),
                safety_score: analysis.score as number,
                grade: analysis.grade as string,
                image_url: prev?.image_url,
                fssai_license: (label?.fssai_license as string | null) ?? prev?.fssai_license ?? null,
                // Preserve the barcode that brought the user to this page
                // (lookup-route prefix or DB barcode) — it's used by the
                // "More details" panel and the report-issue mailto link.
                barcode: prev?.barcode,
                // Pull nutritional_info from the freshly-extracted label
                // when available; otherwise keep what we already had.
                // Without this, scanning a label after the product loaded
                // from DB would erase its nutrition panel.
                nutritional_info:
                  (label?.nutritional_info as Record<string, unknown> | null | undefined) ??
                  prev?.nutritional_info ??
                  null,
                analysis: mapAnalysisJson(analysis),
              }));
            } else if (data.type === "error") {
              showToast("Couldn't read the label — try better lighting or a closer shot", "error");
            }
          });
          if (!gotResult && gen === loaderGen.current) {
            showToast("Couldn't read the label — try better lighting or a closer shot", "error");
          }
        })
        .catch(() => {
          if (gen !== loaderGen.current) return;
          showToast("Label scan failed — please try again", "error");
        })
        .finally(finish);
    };
    reader.readAsDataURL(file);
  }

  // Main data loader
  useEffect(() => {
    // Bump generation so any in-flight request from a previous product
    // can detect the change and short-circuit instead of overwriting state
    loaderGen.current += 1;
    const gen = loaderGen.current;

    // Reset transient state for the new product
    // When initialProduct is provided by the server, keep it — don't reset to null
    if (!initialProduct) setProduct(null);
    setNotFoundState(false);
    setAnalyzing(false);
    setLabelScanning(false);
    // Everything we load from master/DB/sessionStorage is in English.
    // The translate-on-demand effect below will swap it if needed.
    setAnalysisLang("en");

    // Helper: parse sessionStorage JSON without crashing the page if the
    // value was written by an older version with a different shape
    const safeParse = <T,>(raw: string | null): T | null => {
      if (!raw) return null;
      try { return JSON.parse(raw) as T; } catch { return null; }
    };

    // 0. Try static master sheet first (zero cost, instant)
    const masterProduct = masterLookup(id);
    if (masterProduct && masterProduct.safety_score !== null) {
      const analysis = masterProduct.analysis as unknown as Record<string, unknown> | null;
      setProduct({
        id,
        name: masterProduct.name,
        brand: masterProduct.brand,
        category: masterProduct.category,
        ingredients: masterProduct.ingredients,
        safety_score: masterProduct.safety_score,
        grade: masterProduct.score_grade,
        image_url: masterProduct.image_url || undefined,
        fssai_license: (masterProduct as unknown as Record<string, unknown>).fssai_license as string | null ?? null,
        analysis: analysis ? mapAnalysisJson(analysis) : undefined,
      });
      recordScan({
        id,
        name: masterProduct.name,
        brand: masterProduct.brand,
        category: masterProduct.category,
        safety_score: masterProduct.safety_score,
        grade: masterProduct.score_grade,
      });
      return; // Done — no DB or API calls needed
    }

    // 1. Try Supabase DB
    getDbProduct(id)
      .then((dbProduct) => {
        if (gen !== loaderGen.current) return null;
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
          fssai_license: dbProduct.fssai_license,
          barcode: dbProduct.barcode,
          nutritional_info: (dbProduct.nutritional_info as Record<string, unknown> | null) ?? null,
          analysis: analysis ? mapAnalysisJson(analysis) : undefined,
        });
        recordScan({
          id: dbProduct.barcode,
          name: dbProduct.name,
          brand: dbProduct.brand,
          category: dbProduct.category as string,
          safety_score: dbProduct.safety_score,
          grade: dbProduct.score_grade,
        });
        return dbProduct;
      })
      .then((found) => {
        if (gen !== loaderGen.current) return;
        if (!found) {
          loadExternal(id);
          return;
        }
        const dbAnalysis = found.analysis as unknown as Record<string, unknown> | null;
        if (!dbAnalysis && hasCleanIngredients(found.ingredients ?? [])) {
          runAnalysis(found.ingredients, found.category as string, found.barcode);
        }
      })
      .catch(() => {
        if (gen === loaderGen.current) loadExternal(id);
      });

    function loadExternal(productId: string) {
      if (gen !== loaderGen.current) return;

      // OFF products
      if (productId.startsWith("off-")) {
        const barcode = productId.replace("off-", "");
        const stored = safeParse<Record<string, unknown>>(sessionStorage.getItem(`off-product-${barcode}`));

        if (stored) {
          setProduct(mapRawToProduct(stored));
          recordScan({
            id: (stored.id as string) || productId,
            name: (stored.name as string) || "Unknown Product",
            brand: (stored.brand as string) || "Unknown",
            category: (stored.category as string) || "Food",
            safety_score: (stored.safety_score as number | null | undefined) ?? null,
            grade: (stored.grade as string | null | undefined) ?? null,
          });
          if (stored.needs_analysis && hasCleanIngredients((stored.ingredients as string[]) ?? [])) {
            runAnalysis(stored.ingredients as string[], stored.category as string, barcode);
          }
          return;
        }

        fetch("/api/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (gen !== loaderGen.current) return;
            if (data?.found && data.product) {
              setProduct(mapRawToProduct(data.product));
              recordScan(data.product);
              if (data.needs_analysis && hasCleanIngredients(data.product.ingredients ?? [])) {
                runAnalysis(data.product.ingredients, data.product.category, barcode);
              }
            } else {
              setNotFoundState(true);
            }
          })
          .catch(() => {
            if (gen === loaderGen.current) setNotFoundState(true);
          });
        return;
      }

      // Web-enriched products
      if (productId.startsWith("web-")) {
        const barcode = productId.replace("web-", "");
        const stored = safeParse<Record<string, unknown>>(sessionStorage.getItem(`web-product-${barcode}`));
        if (stored) {
          setProduct(mapRawToProduct({ ...stored, id: (stored.id as string) || productId }));
          recordScan({
            id: (stored.id as string) || productId,
            name: (stored.name as string) || "Unknown Product",
            brand: (stored.brand as string) || "Unknown",
            category: (stored.category as string) || "Food",
            safety_score: (stored.safety_score as number | null | undefined) ?? null,
            grade: (stored.grade as string | null | undefined) ?? null,
          });
          if (stored.needs_analysis && hasCleanIngredients((stored.ingredients as string[]) ?? [])) {
            runAnalysis(stored.ingredients as string[], stored.category as string, barcode);
          }
          return;
        }
      }

      // Analyzed products from photo scan
      const analyzed = safeParse<Record<string, unknown>>(sessionStorage.getItem(`analyzed-${productId}`));
      if (analyzed) {
        setProduct(mapRawToProduct(analyzed));
        recordScan({
          id: (analyzed.id as string) || productId,
          name: (analyzed.name as string) || "Unknown Product",
          brand: (analyzed.brand as string) || "Unknown",
          category: (analyzed.category as string) || "Food",
          safety_score: (analyzed.safety_score as number | null | undefined) ?? null,
          grade: (analyzed.grade as string | null | undefined) ?? null,
        });
        return;
      }

      setNotFoundState(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleCompare() {
    if (!product) return;
    if (inCompare) {
      await removeFromCompare(product.id);
      showToast("Removed from compare", "info");
      return;
    }
    const result = await addToCompare({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      safety_score: product.safety_score,
      grade: product.grade,
      summary: product.analysis?.summary,
    });
    if (result === "added") {
      showToast("Added to compare", "success");
    } else if (result === "full") {
      showToast(`Compare holds up to ${LIMITS.COMPARE_MAX} products — remove one first`, "error");
    }
  }

  // Personalized warnings — runs after analysis is present and only if the
  // user has set up conditions/allergies in their profile. Per-request
  // (not cached in DB) since it's user-specific.
  const profileKey = JSON.stringify([userData.profile.conditions, userData.profile.allergies, userData.profile.language]);
  useEffect(() => {
    if (!product?.analysis?.ingredients?.length) return;
    const profile = userData.profile;
    if (!hasPersonalization(profile)) return;

    const controller = new AbortController();
    const gen = loaderGen.current;
    setPersonalLoading(true);
    fetch("/api/personalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredients: product.ingredients,
        conditions: profile.conditions,
        allergies: profile.allergies,
      }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (gen !== loaderGen.current) return;
        setPersonalWarnings(Array.isArray(data?.warnings) ? data.warnings : []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        // Silent fail — personalized warnings are additive, not required.
        if (gen === loaderGen.current) setPersonalWarnings([]);
      })
      .finally(() => {
        if (gen === loaderGen.current) setPersonalLoading(false);
      });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.analysis?.summary, profileKey]);

  // Translate cached analysis on the fly when the user's language is set
  // to Hindi but the currently-displayed analysis is English. Runs once
  // per (analysis, lang) pair — skips if already in the target language.
  useEffect(() => {
    if (!product?.analysis) return;
    if (lang === analysisLang) return;
    if (lang !== "hi") return; // only Hindi is supported right now

    const controller = new AbortController();
    const gen = loaderGen.current;
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysis: {
          score: product.safety_score ?? 0,
          grade: product.grade ?? "C",
          summary: product.analysis.summary,
          ingredients: product.analysis.ingredients.map((i) => ({
            name: i.name,
            risk_level: i.risk,
            explanation: i.explanation,
          })),
          warnings: product.analysis.warnings,
          healthier_alternative: product.analysis.healthier_alternative,
        },
        targetLang: "hi",
      }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (gen !== loaderGen.current) return;
        if (!data?.analysis) return;
        setProduct((prev) =>
          prev ? { ...prev, analysis: mapAnalysisJson(data.analysis) } : prev,
        );
        setAnalysisLang("hi");
      })
      .catch(() => { /* translation is additive — fall back to English silently */ });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.analysis?.summary, lang]);


  // Fetch top-rated products in the same category for the recommendation
  // strip at the bottom. Excludes the current product.
  useEffect(() => {
    if (!product?.category || !product?.id) return;
    const gen = loaderGen.current;
    getTopRatedInCategory(product.category, product.barcode ?? product.id, 8)
      .then((rows) => {
        if (gen !== loaderGen.current) return;
        // Map DB rows to the UI Product shape used by ProductCardHorizontal.
        const mapped: Product[] = rows.map((p) => ({
          id: p.barcode,
          barcode: p.barcode,
          name: p.name,
          brand: p.brand,
          category: p.category as string,
          ingredients: p.ingredients,
          safety_score: p.safety_score ?? null,
          grade: (p.score_grade as Product["grade"]) ?? null,
          image_url: p.image_url || "",
          analysis: { summary: "", ingredients: [], warnings: [], healthier_alternative: "" },
        }));
        setTopRated(mapped);
      })
      .catch(() => {
        if (gen === loaderGen.current) setTopRated([]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.category]);

  // ── Render states ──────────────────────────────────────────────────────────

  if (notFoundState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center" style={{ background: "#F2F2F7" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) scanLabel(f); e.target.value = ""; }}
        />
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: "rgba(0,122,255,0.10)" }}
        >
          <Camera size={36} color="#007AFF" />
        </div>
        <h1 className="text-[20px] font-bold text-black mb-2">Not in our database</h1>
        <p className="text-sm mb-6 max-w-xs" style={{ color: "#8E8E93" }}>
          Scan the ingredient label on the back of the packaging and we&apos;ll analyse it in real time.
        </p>
        {labelScanning ? (
          <div className="flex items-center gap-2 px-6 py-3 rounded-full" style={{ background: "#007AFF" }}>
            <Loader2 size={16} color="#fff" className="animate-spin" />
            <span className="text-sm font-semibold text-white">Analysing label…</span>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm"
            style={{ background: "#007AFF", boxShadow: "0 4px 16px rgba(0,122,255,0.36)" }}
          >
            <Camera size={16} color="#fff" />
            Scan Ingredient Label
          </motion.button>
        )}
        <Link href="/scan" className="mt-4 text-sm font-medium" style={{ color: "#8E8E93" }}>
          Scan a different product
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-dvh" style={{ background: "#F2F2F7" }}>
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
            className="flex items-center gap-2 px-3 py-2 rounded-full glass-light border border-black/[0.08] focus-visible:ring-2 focus-visible:ring-oasis-green"
          >
            <ArrowLeft size={16} className="text-oasis-text" aria-hidden="true" />
            <span className="text-xs font-medium text-oasis-text">{t('back', language)}</span>
          </motion.div>
        </Link>
      </div>

      {/* Floating bookmark button (top-right, mirrors Oasis) */}
      <div className="fixed top-4 right-4 z-50">
        <motion.button
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={async () => {
            if (!product) return;
            const result = await toggleBookmark({
              id: product.id,
              name: product.name,
              brand: product.brand,
              category: product.category,
              safety_score: product.safety_score,
              grade: product.grade,
            });
            showToast(result === "added" ? "Saved" : "Removed from saved", "info");
          }}
          aria-label={isBookmarked ? "Remove from saved" : "Save product"}
          aria-pressed={isBookmarked}
          className="flex items-center justify-center w-10 h-10 rounded-full glass-light border border-black/[0.08] focus-visible:ring-2 focus-visible:ring-oasis-green"
        >
          {isBookmarked ? (
            <BookmarkCheck size={18} className="text-[#007AFF]" />
          ) : (
            <Bookmark size={18} className="text-oasis-text" />
          )}
        </motion.button>
      </div>

      <motion.div
        className="max-w-lg mx-auto pb-8 relative"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {/* Status banners */}
        {(analyzing || labelScanning) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mx-5 mt-14 mb-2 flex items-center gap-3 p-3 rounded-xl border ${
              labelScanning
                ? "bg-[#007AFF]/10 border-[#007AFF]/20"
                : "bg-oasis-green/10 border-oasis-green/20"
            }`}
          >
            <Loader2 size={16} className={`${labelScanning ? "text-[#007AFF]" : "text-oasis-green"} animate-spin shrink-0`} />
            <p className={`text-xs font-medium ${labelScanning ? "text-[#007AFF]" : "text-oasis-green"}`}>
              {labelScanning ? "Reading label and scoring ingredients…" : analyzingMessage}
            </p>
          </motion.div>
        )}

        {/* Product photo — prominent at the top of the hero like Oasis */}
        {product.image_url && (
          <motion.div
            variants={fadeUp}
            className={`flex justify-center px-5 ${analyzing || labelScanning ? "pt-4" : "pt-20"} pb-2`}
          >
            <div className="w-[140px] h-[180px] rounded-2xl bg-white overflow-hidden relative" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="140px"
                className="object-contain"
                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }}
              />
            </div>
          </motion.div>
        )}

        {/* Score Hero */}
        <motion.div
          variants={fadeUp}
          className={`flex flex-col items-center px-5 ${product.image_url ? "pt-2" : (analyzing || labelScanning ? "pt-4" : "pt-20")} pb-5`}
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
            <div className="w-[168px] h-[168px] rounded-full bg-white border-2 border-sift-sep-opaque flex items-center justify-center" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              {analyzing || labelScanning ? (
                <Loader2 size={40} className={`${labelScanning ? "text-[#007AFF]" : "text-oasis-green"} animate-spin`} />
              ) : (
                <Camera size={36} color="#007AFF" />
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
          <motion.div variants={fadeUp} className="flex items-center gap-1.5 mt-2 flex-wrap justify-center">
            <span className="inline-block text-[11px] px-3 py-1 rounded-full bg-oasis-green/10 text-oasis-green font-medium">
              {product.category}
            </span>
            {id.startsWith("manual-") && (
              <span
                className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-[#FF9F0A]/10 text-[#B87800] font-semibold"
                title="User-submitted — not yet reviewed by our team"
              >
                <AlertTriangle size={10} />
                Community submitted
              </span>
            )}
          </motion.div>
        </motion.div>

        {/* At-a-glance ingredient tally — only when we have analysis */}
        {product.analysis && product.analysis.ingredients.length > 0 && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div className="flex items-center gap-3 px-4 py-3">
                <AlertTriangle size={15} className="text-[#CC1010] shrink-0" />
                <span className="text-[13px] text-black flex-1">{t('harmful_substances', language)}</span>
                <span
                  className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-[12px] font-bold text-white tabular-nums px-2"
                  style={{ background: ingredientCounts.harmful === 0 ? "#1E8040" : "#CC1010" }}
                >
                  {ingredientCounts.harmful}
                </span>
              </div>
              <div className="h-px bg-black/[0.04] mx-4" />
              <div className="flex items-center gap-3 px-4 py-3">
                <Leaf size={15} className="text-[#1E8040] shrink-0" />
                <span className="text-[13px] text-black flex-1">{t('beneficial_ingredients', language)}</span>
                <span
                  className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-[12px] font-bold text-white tabular-nums px-2"
                  style={{ background: ingredientCounts.beneficial > 0 ? "#1E8040" : "#8E8E93" }}
                >
                  {ingredientCounts.beneficial}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Share buttons */}
        <motion.div variants={fadeUp} className="px-5 mb-4">
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                const text = `I scanned ${product.name} on Sift — it scored ${score}/100 (Grade ${grade}). ${level.label}! 🌿\n\nScan your products: ${window.location.origin}`;
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
                    text: `I scanned ${product.name} on Sift. It scored ${score}/100 (Grade ${grade}). ${product.analysis?.summary || ""}`,
                    url: window.location.href,
                  }).catch(() => {});
                } else {
                  navigator.clipboard?.writeText(window.location.href).then(() => {
                    showToast("Link copied!", "success");
                  }).catch(() => {});
                }
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-black/[0.08] active:bg-[#F2F2F7] transition-colors"
            >
              <Share2 size={15} className="text-oasis-green" />
              <span className="text-sm font-medium text-oasis-text">{t('share', language)}</span>
            </motion.button>
          </div>

          {/* Compare CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={toggleCompare}
            aria-pressed={inCompare}
            className={`w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-colors ${
              inCompare
                ? "bg-[#007AFF]/10 border-[#007AFF]/25"
                : "bg-white border-black/[0.08] active:bg-[#F2F2F7]"
            }`}
          >
            {inCompare ? (
              <Check size={15} className="text-[#007AFF]" />
            ) : (
              <Scale size={15} className="text-oasis-text" />
            )}
            <span className={`text-sm font-medium ${inCompare ? "text-[#007AFF]" : "text-oasis-text"}`}>
              {inCompare ? "In compare — tap to remove" : t('add_to_compare', language)}
            </span>
          </motion.button>
          {inCompare && (
            <Link
              href="/compare"
              className="flex items-center justify-center gap-1 mt-2 text-xs font-semibold"
              style={{ color: "#007AFF" }}
            >
              View comparison ({userData.compareList.length}/{3})
              <ChevronRight size={12} />
            </Link>
          )}
        </motion.div>

        {/* Summary card */}
        {hasScore && product.analysis?.summary && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <div className={`flex items-start gap-3 p-4 rounded-2xl ${level.bg} border border-black/[0.06] border-l-[3px] ${level.border}`}>
              <ShieldAlert size={20} className={`${level.color} shrink-0 mt-0.5`} />
              <div>
                <span className={`text-sm font-bold ${level.color}`}>
                  {t('overall', language)}: {level.label === "Safe" ? t('safe', language) : level.label === "Moderate" ? t('caution', language) : level.label === "Concerning" ? t('warning', language) : t('danger', language)}
                </span>
                <p className="text-xs text-oasis-text-secondary leading-relaxed mt-1">
                  {product.analysis.summary}
                </p>
              </div>
            </div>
          </motion.div>
        )}


        {/* Hidden file input for label scanning */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) scanLabel(f); e.target.value = ""; }}
        />

        {/* Ingredient section — always shows something */}
        <motion.div variants={fadeUp} className="px-5 mb-4">
          <h2 className="font-semibold text-[17px] text-oasis-text mb-3">{t('ingredient_analysis', language)}</h2>

          {/* Analysis complete — show per-ingredient cards */}
          {product.analysis && product.analysis.ingredients.length > 0 && (
            <IngredientList ingredients={product.analysis.ingredients} />
          )}

          {/* Analysis done but Gemini returned empty ingredients — fallback chips + retry */}
          {product.analysis && product.analysis.ingredients.length === 0 && (
            <div className="p-4 rounded-2xl bg-oasis-card border border-oasis-border">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {product.ingredients.map((ing, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-[11px] font-medium text-oasis-text" style={{ background: "#F2F2F7" }}>
                    {ing}
                  </span>
                ))}
              </div>
              <button
                onClick={() => runAnalysis(product.ingredients, product.category, id.startsWith("off-") ? id.replace("off-", "") : id)}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-oasis-green/10 text-oasis-green border border-oasis-green/20"
              >
                Retry Analysis →
              </button>
            </div>
          )}

          {/* Clean ingredients waiting for analysis — show as chips with spinner */}
          {!product.analysis && hasCleanIngredients(product.ingredients) && (
            <div className="p-4 rounded-2xl bg-oasis-card border border-oasis-border">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {product.ingredients.map((ing, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-[11px] font-medium text-oasis-text" style={{ background: "#F2F2F7" }}>
                    {ing}
                  </span>
                ))}
              </div>
              {analyzing || labelScanning ? (
                <div className="flex items-center gap-2 mt-1">
                  <Loader2 size={12} className="text-oasis-green animate-spin" />
                  <span className="text-[11px] text-oasis-green font-medium">Scoring each ingredient…</span>
                </div>
              ) : (
                <button
                  onClick={() => runAnalysis(product.ingredients, product.category, id.startsWith("off-") ? id.replace("off-", "") : id)}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-oasis-green/10 text-oasis-green border border-oasis-green/20"
                >
                  Analyse Ingredients →
                </button>
              )}
            </div>
          )}

          {/* No usable ingredients (missing or garbage data) — prompt label scan */}
          {!product.analysis && !hasCleanIngredients(product.ingredients) && !analyzing && !labelScanning && (
            <div className="p-5 rounded-2xl bg-[#007AFF]/05 border border-[#007AFF]/15 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(0,122,255,0.10)" }}>
                <Camera size={22} color="#007AFF" />
              </div>
              <div>
                <p className="text-sm font-semibold text-black">Ingredient data unavailable</p>
                <p className="text-[12px] mt-1" style={{ color: "#8E8E93" }}>
                  Point your camera at the ingredient list on the back of the pack for an instant safety score.
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-semibold text-sm"
                style={{ background: "#007AFF", boxShadow: "0 4px 14px rgba(0,122,255,0.30)" }}
              >
                <Camera size={14} color="#fff" />
                Scan Ingredient Label
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Warnings for You — personalized, only when profile has conditions/allergies */}
        {product.analysis && (personalLoading || (personalWarnings && personalWarnings.length > 0)) && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <UserCircle size={16} className="text-[#007AFF]" />
              <h2 className="font-semibold text-[17px] text-oasis-text">Warnings for You</h2>
            </div>
            {personalLoading ? (
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-oasis-card border border-oasis-border">
                <Loader2 size={14} className="text-[#007AFF] animate-spin" />
                <span className="text-xs text-oasis-muted">Checking against your health profile…</span>
              </div>
            ) : (
              <div className="space-y-2">
                {personalWarnings!.map((w, i) => {
                  const isSerious = w.severity === "serious";
                  const isModerate = w.severity === "moderate";
                  const bg = isSerious ? "bg-[#FFF0EE]" : isModerate ? "bg-[#FFF2E8]" : "bg-[#EBF3FF]";
                  const border = isSerious ? "border-[#FF3B30]/20" : isModerate ? "border-[#FF9F0A]/20" : "border-[#007AFF]/20";
                  const iconColor = isSerious ? "text-[#CC1010]" : isModerate ? "text-[#CC5200]" : "text-[#0056CC]";
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`flex items-start gap-2.5 p-3 rounded-xl ${bg} border ${border}`}
                    >
                      <AlertTriangle size={14} className={`${iconColor} shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${iconColor} leading-relaxed`}>{w.warning}</p>
                        <p className="text-[10px] text-oasis-muted mt-1">
                          {w.related_condition} · {w.triggering_ingredient}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Warnings (generic) */}
        {product.analysis && product.analysis.warnings.length > 0 && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <h2 className="font-semibold text-[17px] text-oasis-text mb-3">{t('warnings', language)}</h2>
            <div className="space-y-2">
              {product.analysis.warnings.map((w, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FFF0EE] border border-[#FF3B30]/15 warning-pulse"
                >
                  <div className="w-5 h-5 rounded-full bg-[#FF3B30]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle size={11} className="text-[#CC1010]" />
                  </div>
                  <p className="text-xs text-[#CC1010] leading-relaxed">{w}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Healthier Alternative */}
        {product.analysis?.healthier_alternative && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#F0FBF4] border border-[#1E8040]/15 relative overflow-hidden">
              <Leaf size={20} className="text-[#1E8040] shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-sm font-bold text-[#1E8040]">Healthier Alternative</span>
                <p className="text-xs text-oasis-text-secondary leading-relaxed mt-1">
                  {product.analysis.healthier_alternative}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Buy Online — affiliate links */}
        {product.name && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <BuyOnline productName={product.name} brand={product.brand} />
          </motion.div>
        )}

        {/* Nutrition Facts — collapsible */}
        {product.nutritional_info && typeof product.nutritional_info === "object" && Object.keys(product.nutritional_info).length > 0 && (
          <motion.div variants={fadeUp} className="px-5 mb-4">
            <button
              onClick={() => setShowNutrition((v) => !v)}
              className="w-full flex items-center justify-between mb-3"
            >
              <h2 className="font-semibold text-[17px] text-oasis-text">Nutrition Facts</h2>
              <motion.div animate={{ rotate: showNutrition ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={18} className="text-oasis-muted" />
              </motion.div>
            </button>
            {showNutrition && (
              <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                {Object.entries(product.nutritional_info)
                  .filter(([, v]) => v != null && v !== "")
                  .slice(0, 12)
                  .map(([key, value], i) => (
                    <div key={key} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-black/[0.04]" : ""}`}>
                      <span className="text-[13px] text-black capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-[13px] font-semibold text-black tabular-nums">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Other info — collapsible */}
        <motion.div variants={fadeUp} className="px-5 mb-4">
          <button
            onClick={() => setShowOtherInfo((v) => !v)}
            className="w-full flex items-center justify-between mb-3"
          >
            <h2 className="font-semibold text-[17px] text-oasis-text">More details</h2>
            <motion.div animate={{ rotate: showOtherInfo ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown size={18} className="text-oasis-muted" />
            </motion.div>
          </button>
          {showOtherInfo && (
            <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              {product.barcode && (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Package size={14} className="text-oasis-muted" />
                    <span className="text-[13px] text-black">Barcode</span>
                  </div>
                  <span className="text-[12px] font-mono text-oasis-muted">{product.barcode}</span>
                </div>
              )}
              <div className={`flex items-center justify-between px-4 py-3 ${product.barcode ? "border-t border-black/[0.04]" : ""}`}>
                <div className="flex items-center gap-2.5">
                  <Info size={14} className="text-oasis-muted" />
                  <span className="text-[13px] text-black">Category</span>
                </div>
                <span className="text-[13px] font-semibold text-black capitalize">{product.category}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Top rated in category — discovery */}
        {topRated.length > 0 && (
          <motion.div variants={fadeUp} className="mb-4">
            <div className="flex items-center gap-2 px-5 mb-3">
              <Sparkles size={15} className="text-[#007AFF]" />
              <h2 className="font-semibold text-[17px] text-oasis-text">Top-rated {product.category.toLowerCase()}</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar px-5 pb-1">
              {topRated.map((p) => (
                <ProductCardHorizontal key={p.id} product={p} />
              ))}
            </div>
          </motion.div>
        )}

        {/* Footer actions — how scoring works + report an issue + personalization hint */}
        <motion.div variants={fadeUp} className="px-5 space-y-2">
          <Link
            href="/scoring"
            className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-black/[0.06] active:bg-[#F2F2F7] transition-colors"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Info size={16} className="text-[#007AFF] shrink-0" />
            <span className="text-sm font-semibold text-oasis-text flex-1">How scoring works</span>
            <ExternalLink size={14} className="text-oasis-muted" />
          </Link>

          <Link
            href={`mailto:reports@sift.app?subject=${encodeURIComponent(`Issue with ${product.name}`)}&body=${encodeURIComponent(`Product: ${product.name}\nBrand: ${product.brand}\nBarcode: ${product.barcode ?? id}\nScore: ${score}/100 (Grade ${grade})\n\nDescribe the issue:`)}`}
            className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-black/[0.06] active:bg-[#F2F2F7] transition-colors"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
          >
            <Flag size={16} className="text-oasis-muted shrink-0" />
            <span className="text-sm font-semibold text-oasis-text flex-1">Report an issue</span>
            <ExternalLink size={14} className="text-oasis-muted" />
          </Link>

          {!hasPersonalization(userData.profile) && (
            <Link
              href="/profile"
              className="flex items-start gap-3 p-4 rounded-2xl bg-[#007AFF]/08 border border-[#007AFF]/15"
            >
              <Heart size={16} className="text-[#007AFF] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-oasis-text block">Personalise your warnings</span>
                <p className="text-xs text-oasis-muted leading-relaxed mt-1">
                  Add your conditions and allergies in Profile to see warnings tailored to you.
                </p>
              </div>
            </Link>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
