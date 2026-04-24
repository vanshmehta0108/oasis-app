"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PackageX, ArrowLeft, Camera, Sparkles } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import Link from "next/link";
import { useUserData } from "@/lib/userData";

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

export default function ScanPage() {
  const router = useRouter();
  const { data: userData } = useUserData();
  const lang = apiLang(userData.profile.language);
  const [state, setState] = useState<ScanState>("scanning");
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("Looking Up Product...");
  const [loadingNote, setLoadingNote] = useState("");

  const handleScan = useCallback(async (barcode: string) => {
    if (navigator.vibrate) navigator.vibrate(60);
    setScannedBarcode(barcode);
    setState("looking-up");
    setLoadingLabel("Looking Up Product...");
    setLoadingNote(`Barcode: ${barcode}`);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });

      if (!res.ok) { setState("not-found"); return; }

      const data: LookupResult = await res.json();
      if (!data.found || !data.product) { setState("not-found"); return; }

      let product = data.product;

      // Always compute a score on the spot if we have ingredients
      if (data.needs_analysis && product.ingredients?.length > 0) {
        setState("analyzing");
        setLoadingLabel("Analysing Ingredients...");
        setLoadingNote("AI is scoring each ingredient for safety");

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
            const aData = await aRes.json();
            if (aData.analysis) {
              product = {
                ...product,
                safety_score: aData.analysis.score,
                grade: aData.analysis.grade,
                analysis: {
                  summary: aData.analysis.summary,
                  ingredients: (aData.analysis.ingredients || []).map(mapIngredient),
                  warnings: aData.analysis.warnings || [],
                  healthier_alternative: aData.analysis.healthier_tip || aData.analysis.healthier_alternative || "",
                },
              };
            }
          }
        } catch {
          // analysis failed — product page will show label scan prompt
        }
      }

      // Store enriched product data for the product page
      const source = data.source;
      if (source === "openfoodfacts") {
        sessionStorage.setItem(`off-product-${barcode}`, JSON.stringify({ ...product, needs_analysis: false }));
      } else if (source === "web") {
        sessionStorage.setItem(`web-product-${barcode}`, JSON.stringify({ ...product, needs_analysis: false }));
      } else if ((source === "database" || source === "master") && product.analysis) {
        // Cache enriched DB product so product page doesn't re-fetch
        sessionStorage.setItem(`db-product-${barcode}`, JSON.stringify({ ...product, needs_analysis: false }));
      }

      router.push(`/product/${product.id}`);
    } catch {
      setState("not-found");
    }
  }, [router, lang]);

  const handlePhoto = async (base64: string) => {
    setState("analyzing-photo");
    setLoadingLabel("Reading Ingredient Label...");
    setLoadingNote("AI is extracting and scoring ingredients");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, lang }),
      });
      if (res.ok) {
        const data = await res.json();
        const productId = data.product?.barcode || data.product?.id || `analyzed-${Date.now()}`;
        sessionStorage.setItem(`analyzed-${productId}`, JSON.stringify({
          id: productId,
          name: data.label_extraction?.product_name || data.product?.name || "Scanned Product",
          brand: data.label_extraction?.brand || data.product?.brand || "Unknown",
          category: data.label_extraction?.category_guess || "food",
          ingredients: data.label_extraction?.ingredients || [],
          safety_score: data.analysis?.score ?? null,
          grade: data.analysis?.grade ?? null,
          fssai_license: data.label_extraction?.fssai_license ?? null,
          analysis: data.analysis ? {
            summary: data.analysis.summary,
            ingredients: (data.analysis.ingredients || []).map(mapIngredient),
            warnings: data.analysis.warnings || [],
            healthier_alternative: data.analysis.healthier_tip || data.analysis.healthier_alternative || "",
          } : null,
        }));
        router.push(`/product/${productId}`);
      } else {
        setState("not-found");
      }
    } catch {
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
            <span className="text-xs font-medium text-white">Back</span>
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

            <p className="text-[11px] text-oasis-muted">Powered by AI</p>
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
            <h2 className="font-semibold text-[18px] text-oasis-text">Product Not Found</h2>
            <p className="text-sm text-oasis-muted text-center leading-relaxed max-w-xs">
              {scannedBarcode && (
                <>Barcode <span className="text-oasis-text font-mono text-xs bg-oasis-card px-2 py-0.5 rounded">{scannedBarcode}</span> isn&apos;t in our database. </>
              )}
              Photograph the ingredient label and our AI will score it instantly.
            </p>

            <div className="flex gap-3 mt-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setState("scanning")}
                className="px-5 py-2.5 rounded-full border border-oasis-border text-sm font-medium text-oasis-text"
              >
                Scan Again
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
                Photograph Label
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
