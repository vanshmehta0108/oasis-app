"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

// Landing page after /share receives a shared image. Reads the image
// out of the short-lived sift-share-image cookie, POSTs it to
// /api/analyze just like the scan flow does, then redirects to the
// resulting product page.
export default function ShareInboxPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Analysing what you shared…");

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)sift-share-image=([^;]+)/);
    if (!match) {
      setMsg("Nothing was shared — opening scanner instead.");
      const t = setTimeout(() => router.replace("/scan"), 1000);
      return () => clearTimeout(t);
    }

    // Clear the cookie immediately so a refresh doesn't re-process the
    // same payload.
    document.cookie = "sift-share-image=; path=/; max-age=0";
    const dataUrl = decodeURIComponent(match[1]);

    const run = async () => {
      try {
        const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });

        if (!res.ok) {
          setMsg("Couldn't read that image. Opening scanner so you can retry.");
          setTimeout(() => router.replace("/scan"), 1500);
          return;
        }

        const data = await res.json();
        const productId = data.product?.barcode || data.product?.id || `analyzed-${Date.now()}`;
        sessionStorage.setItem(
          `analyzed-${productId}`,
          JSON.stringify({
            id: productId,
            name: data.label_extraction?.product_name || data.product?.name || "Shared Product",
            brand: data.label_extraction?.brand || data.product?.brand || "Unknown",
            category: data.label_extraction?.category_guess || "food",
            ingredients: data.label_extraction?.ingredients || [],
            safety_score: data.analysis?.score ?? null,
            grade: data.analysis?.grade ?? null,
            fssai_license: data.label_extraction?.fssai_license ?? null,
            analysis: data.analysis
              ? {
                  summary: data.analysis.summary,
                  ingredients: (data.analysis.ingredients || []).map((i: { name: string; risk_level?: string; risk?: string; explanation: string }) => ({
                    name: i.name,
                    risk: i.risk || i.risk_level || "caution",
                    explanation: i.explanation,
                  })),
                  warnings: data.analysis.warnings || [],
                  healthier_alternative: data.analysis.healthier_tip || data.analysis.healthier_alternative || "",
                }
              : null,
          }),
        );
        router.replace(`/product/${productId}`);
      } catch {
        setMsg("Something went wrong. Opening scanner…");
        setTimeout(() => router.replace("/scan"), 1500);
      }
    };

    run();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-dvh gap-5 gradient-mesh-intense">
      <div className="relative w-20 h-20 rounded-full bg-[#007AFF]/10 flex items-center justify-center">
        <Sparkles size={32} className="text-[#007AFF]" />
        <Loader2 size={64} className="absolute inset-2 text-[#007AFF]/40 animate-spin" />
      </div>
      <p className="text-sm font-medium text-black text-center max-w-xs px-6">{msg}</p>
    </div>
  );
}
