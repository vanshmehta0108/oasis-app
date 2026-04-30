"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { PackageX, ArrowLeft, Camera, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { useUserData } from "@/lib/userData";
import { t } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";

// Lazy-load the Scanner — it pulls in html5-qrcode (~100 KB minified, plus
// its own decoder bundle) which is only needed once a user actually opens
// the scan page. Without dynamic import, that weight is in the shared
// chunk and slows every other page's first paint too.
const Scanner = dynamic(
  () => import("@/components/Scanner").then((m) => m.Scanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-dvh gap-4 bg-black">
        <Loader2 size={28} className="text-white/70 animate-spin" />
        <p className="text-white/60 text-xs">Starting camera…</p>
      </div>
    ),
  },
);

// Map the app's stored language value to the API's lang param.
function apiLang(language: "English" | "Hindi"): "en" | "hi" {
  return language === "Hindi" ? "hi" : "en";
}

type ScanState = "scanning" | "looking-up" | "analyzing" | "not-found" | "analyzing-photo";

interface LookupResult {
  found: boolean;
  source?: "local" | "master" | "database" | "openfoodfacts" | "web";
  product?: {
    id: string;
    barcode: string;
    name: string;
    brand: string;
    category: string;
    ingredients: string[];
    safety_score?: number | null;
    grade?: string | null;
    image_url?: string;
    analysis?: unknown;
  };
  needs_analysis?: boolean;
}

function mapIngredient(ing: { name: string; risk_level?: string; risk?: string; explanation: string }) {
  return { name: ing.name, risk: ing.risk || ing.risk_level || "caution", explanation: ing.explanation };
}

// Reads a text/event-stream response and returns the data from the first
// "complete" event, or null if the stream ends without one.
async function readSSEComplete(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let result: Record<string, unknown> | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) buf += decoder.decode(value, { stream: !done });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(line.slice(6)) as Record<string, unknown>;
          if (evt.type === "complete") result = evt;
        } catch { /* ignore malformed lines */ }
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  return result;
}

export default function ScanPage() {
  const router = useRouter();
  const { data: userData } = useUserData();
  const lang = apiLang(userData.profile.language);
  const [state, setState] = useState<ScanState>("scanning");
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [loadingLabel, setLoadingLabel] = useState(t('looking_up', lang));
  const [loadingNote, setLoadingNote] = useState("");

  const handleScan = useCallback(async (barcode: string) => {
    // Cross-platform success haptic — Scanner.tsx already fired one on lock,
    // this second one tags the "lookup starting" moment so the user gets a
    // clear two-stage confirmation: "barcode read" → "fetching product".
    haptic("tap");
    setScannedBarcode(barcode);
    setState("looking-up");
    setLoadingLabel(t('looking_up', lang));
    setLoadingNote(`Barcode · ${barcode}`);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });

      if (!res.ok) { haptic("error"); setState("not-found"); return; }

      const data: LookupResult = await res.json();
      if (!data.found || !data.product) { haptic("error"); setState("not-found"); return; }

      let product = data.product;

      // Always compute a score on the spot if we have ingredients
      if (data.needs_analysis && product.ingredients?.length > 0) {
        setState("analyzing");
        setLoadingLabel(t('analysing', lang));
        setLoadingNote("Scoring each ingredient.");

        try {
          const aRes = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ingredients: product.ingredients,
              category: product.category || "food",
              barcode,
              name: product.name,
              brand: product.brand,
              lang,
            }),
          });
          if (aRes.ok) {
            const evt = await readSSEComplete(aRes);
            if (evt?.analysis) {
              const a = evt.analysis as Record<string, unknown>;
              product = {
                ...product,
                safety_score: a.score as number,
                grade: a.grade as string,
                analysis: {
                  summary: a.summary as string,
                  ingredients: ((a.ingredients as Array<{ name: string; risk_level?: string; risk?: string; explanation: string }>) || []).map(mapIngredient),
                  warnings: (a.warnings as string[]) || [],
                  healthier_alternative: (a.healthier_tip as string) || (a.healthier_alternative as string) || "",
                },
              };
            }
          }
        } catch {
          // analysis failed — product page will show label scan prompt
        }
      }

      // Store enriched product data for the product page. If the inline
      // analyze call above failed (network error / non-OK / empty stream),
      // product.analysis is still missing — keep needs_analysis truthy so
      // ProductClient retries instead of presenting an unanalyzed product
      // marked "no analysis needed".
      const stillNeedsAnalysis = !product.analysis;
      const source = data.source;
      if (source === "openfoodfacts") {
        sessionStorage.setItem(`off-product-${barcode}`, JSON.stringify({ ...product, needs_analysis: stillNeedsAnalysis }));
      } else if (source === "web") {
        sessionStorage.setItem(`web-product-${barcode}`, JSON.stringify({ ...product, needs_analysis: stillNeedsAnalysis }));
      } else if ((source === "database" || source === "master") && product.analysis) {
        // Cache enriched DB product so product page doesn't re-fetch
        sessionStorage.setItem(`db-product-${barcode}`, JSON.stringify({ ...product, needs_analysis: false }));
      }

      // Final success — product is enriched and we're navigating. The
      // ProductClient will render the verdict so we ping a soft success
      // here to mark "data ready, page is loading".
      haptic("success");
      router.push(`/product/${product.id}`);
    } catch {
      haptic("error");
      setState("not-found");
    }
  }, [router, lang]);

  const handlePhoto = async (base64: string) => {
    haptic("tap");
    setState("analyzing-photo");
    setLoadingLabel(t('analysing_label', lang));
    setLoadingNote("Reading the label, scoring ingredients.");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, lang }),
      });
      if (!res.ok) { haptic("error"); setState("not-found"); return; }

      const evt = await readSSEComplete(res);
      if (!evt || evt.type === "error") { haptic("error"); setState("not-found"); return; }

      const label = evt.label_extraction as Record<string, unknown> | null;
      const analysis = evt.analysis as Record<string, unknown> | null;
      const product = evt.product as Record<string, unknown> | null;
      const productId = (product?.barcode as string) || (product?.id as string) || `analyzed-${Date.now()}`;

      sessionStorage.setItem(`analyzed-${productId}`, JSON.stringify({
        id: productId,
        name: (label?.product_name as string) || (product?.name as string) || "Scanned Product",
        brand: (label?.brand as string) || (product?.brand as string) || "Unknown",
        category: (label?.category_guess as string) || "food",
        ingredients: (label?.ingredients as string[]) || [],
        safety_score: (analysis?.score as number) ?? null,
        grade: (analysis?.grade as string) ?? null,
        fssai_license: (label?.fssai_license as string) ?? null,
        analysis: analysis ? {
          summary: analysis.summary as string,
          ingredients: ((analysis.ingredients as Array<{ name: string; risk_level?: string; risk?: string; explanation: string }>) || []).map(mapIngredient),
          warnings: (analysis.warnings as string[]) || [],
          healthier_alternative: (analysis.healthier_tip as string) || (analysis.healthier_alternative as string) || "",
        } : null,
      }));
      haptic("success");
      router.push(`/product/${productId}`);
    } catch {
      haptic("error");
      setState("not-found");
    }
  };

  const isLoading = state === "looking-up" || state === "analyzing" || state === "analyzing-photo";
  const loadingDuration = state === "analyzing" || state === "analyzing-photo" ? 8 : 1.5;

  return (
    <div className="relative min-h-dvh bg-black">
      {/* Back button */}
      <div className="absolute left-4 z-50" style={{ top: "max(1rem, calc(env(safe-area-inset-top) + 0.75rem))" }}>
        <Link href="/" aria-label="Go back to home page">
          <motion.div
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-full"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <ArrowLeft size={16} className="text-white" aria-hidden="true" />
            <span className="text-xs font-medium text-white">{t('back', lang)}</span>
          </motion.div>
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {state === "scanning" && (
          <motion.div key="scanner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Scanner onScan={handleScan} onPhoto={handlePhoto} />
          </motion.div>
        )}

        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-dvh gap-5 gradient-mesh-intense"
          >
            <motion.div
              className="relative w-20 h-20 rounded-full bg-oasis-green/10 flex items-center justify-center"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles size={32} className="text-oasis-green" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-oasis-green/30"
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
              />
            </motion.div>

            <div className="text-center">
              <p className="text-lg font-bold text-oasis-text">{loadingLabel}</p>
              <p className="text-xs text-oasis-muted mt-1.5">{loadingNote}</p>
            </div>

            <div className="w-56 h-1.5 rounded-full bg-oasis-border overflow-hidden">
              <motion.div
                key={state}
                className="h-full rounded-full bg-gradient-to-r from-oasis-green-dim to-oasis-green"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: loadingDuration, ease: "easeInOut" }}
              />
            </div>

            <p className="text-[11px] text-oasis-muted tracking-wider uppercase">Sift</p>
          </motion.div>
        )}

        {state === "not-found" && (
          <motion.div
            key="not-found"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-dvh gap-4 px-8 gradient-mesh"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-20 h-20 rounded-full bg-oasis-card border border-oasis-border flex items-center justify-center"
            >
              <PackageX size={36} className="text-oasis-muted" />
            </motion.div>
            <h2 className="font-semibold text-[18px] text-oasis-text">{t('product_not_found', lang)}</h2>
            <p className="text-sm text-oasis-muted text-center leading-relaxed max-w-xs">
              {scannedBarcode && (
                <>We haven&apos;t seen <span className="text-oasis-text font-mono text-xs bg-oasis-card px-2 py-0.5 rounded">{scannedBarcode}</span> yet. </>
              )}
              {t('photo_prompt', lang)}
            </p>

            <div className="flex gap-3 mt-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setState("scanning")}
                className="px-5 py-2.5 rounded-full border border-oasis-border text-sm font-medium text-oasis-text"
              >
                {t('scan_again', lang)}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.capture = "environment";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => handlePhoto(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-oasis-green text-oasis-black text-sm font-bold pulse-glow"
              >
                <Camera size={16} />
                {t('photograph_label', lang)}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
