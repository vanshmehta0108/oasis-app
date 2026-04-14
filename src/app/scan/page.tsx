"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { PackageX, ArrowLeft, Camera, Sparkles } from "lucide-react";
import { Scanner } from "@/components/Scanner";
import Link from "next/link";

type ScanState = "scanning" | "loading" | "not-found" | "analyzing-photo";

interface LookupResult {
  found: boolean;
  source?: "local" | "openfoodfacts" | "web";
  product?: {
    id: string;
    barcode: string;
    name: string;
    brand: string;
    category: string;
    ingredients: string[];
    safety_score?: number;
    grade?: string;
    image_url?: string;
    analysis?: unknown;
  };
  needs_analysis?: boolean;
}

export default function ScanPage() {
  const router = useRouter();
  const [state, setState] = useState<ScanState>("scanning");
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");

  const handleScan = useCallback(async (barcode: string) => {
    // Haptic feedback on successful scan
    if (navigator.vibrate) navigator.vibrate(50);
    setScannedBarcode(barcode);
    setState("loading");

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });

      if (res.ok) {
        const data: LookupResult = await res.json();
        if (data.found && data.product) {
          // Store product data in sessionStorage for the product page
          if (data.source === "openfoodfacts") {
            sessionStorage.setItem(
              `off-product-${barcode}`,
              JSON.stringify({ ...data.product, needs_analysis: data.needs_analysis })
            );
          } else if (data.source === "web") {
            sessionStorage.setItem(
              `web-product-${barcode}`,
              JSON.stringify({ ...data.product, needs_analysis: data.needs_analysis })
            );
          }
          router.push(`/product/${data.product.id}`);
          return;
        }
      }
      setState("not-found");
    } catch (err) {
      console.error("Lookup failed:", err);
      setState("not-found");
    }
  }, [router]);

  const handlePhoto = async (base64: string) => {
    setState("analyzing-photo");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      if (res.ok) {
        const data = await res.json();
        const productId = data.product?.id || `analyzed-${Date.now()}`;
        sessionStorage.setItem(`analyzed-${productId}`, JSON.stringify({
          id: productId,
          name: data.label_extraction?.product_name || data.product?.name || "Scanned Product",
          brand: data.label_extraction?.brand || data.product?.brand || "Unknown",
          category: data.label_extraction?.category_guess || "food",
          ingredients: data.label_extraction?.ingredients || [],
          safety_score: data.analysis?.score || null,
          grade: data.analysis?.grade || null,
          analysis: data.analysis ? {
            summary: data.analysis.summary,
            ingredients: (data.analysis.ingredients || []).map((ing: { name: string; risk_level?: string; risk?: string; explanation: string }) => ({
              name: ing.name,
              risk: ing.risk || ing.risk_level || "caution",
              explanation: ing.explanation,
            })),
            warnings: data.analysis.warnings,
            healthier_alternative: data.analysis.healthier_tip,
          } : null,
        }));
        router.push(`/product/${productId}`);
      } else {
        setState("not-found");
      }
    } catch (err) {
      console.error("Photo analysis failed:", err);
      setState("not-found");
    }
  };

  return (
    <div className="relative min-h-dvh bg-black">
      {/* Back button */}
      <div className="absolute top-4 left-4 z-50">
        <Link href="/" aria-label="Go back to home page">
          <motion.div
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-full glass-dark border border-white/10"
          >
            <ArrowLeft size={16} className="text-white" aria-hidden="true" />
            <span className="text-xs font-medium text-white">Back</span>
          </motion.div>
        </Link>
      </div>

      <AnimatePresence mode="wait">
        {state === "scanning" && (
          <motion.div
            key="scanner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Scanner onScan={handleScan} onPhoto={handlePhoto} />
          </motion.div>
        )}

        {(state === "loading" || state === "analyzing-photo") && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-dvh gap-5 gradient-mesh-intense"
          >
            {/* Pulsing logo */}
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
              <p className="text-lg font-bold text-oasis-text">
                {state === "analyzing-photo"
                  ? "Analyzing Ingredients..."
                  : "Looking Up Product..."}
              </p>
              <p className="text-xs text-oasis-muted mt-1.5">
                {state === "analyzing-photo"
                  ? "AI is reading the label"
                  : `Barcode: ${scannedBarcode}`}
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-56 h-1.5 rounded-full bg-oasis-border overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-oasis-green-dim to-oasis-green"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{
                  duration: state === "analyzing-photo" ? 3 : 1.5,
                  ease: "easeInOut",
                }}
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
            <h2 className="font-[family-name:var(--font-instrument)] text-xl text-oasis-text">Product Not Found</h2>
            <p className="text-sm text-oasis-muted text-center leading-relaxed max-w-xs">
              Barcode <span className="text-oasis-text font-mono text-xs bg-oasis-card px-2 py-0.5 rounded">{scannedBarcode}</span> isn&apos;t in our database yet. Photograph the label and our AI will analyze it.
            </p>
            {/* Manual entry */}
            <div className="w-full max-w-xs mt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter barcode..."
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && manualBarcode && handleScan(manualBarcode)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-oasis-card border border-oasis-border text-sm text-oasis-text placeholder:text-oasis-muted focus:outline-none focus:border-oasis-green/40"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => manualBarcode && handleScan(manualBarcode)}
                  disabled={!manualBarcode}
                  className="px-4 py-2.5 rounded-xl bg-oasis-green/20 border border-oasis-green/30 text-oasis-green text-sm font-semibold disabled:opacity-50"
                >
                  Go
                </motion.button>
              </div>
            </div>

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
