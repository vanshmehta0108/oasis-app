"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ScoreRing } from "./ScoreRing";
import type { Product } from "@/lib/mockData";

const categoryIcons: Record<string, string> = {
  Food: "🍛",
  Beverages: "🥤",
  Snacks: "🍿",
  Skincare: "✨",
  Baby: "👶",
  Household: "🏠",
};

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const isOFF = product.id.startsWith("off-");
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    // Store OFF product data in sessionStorage so product page can access it
    if (isOFF) {
      const barcode = product.barcode || product.id.replace("off-", "");
      sessionStorage.setItem(
        `off-product-${barcode}`,
        JSON.stringify({ ...product, needs_analysis: true })
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/product/${product.id}`} onClick={handleClick}>
        <motion.div
          whileTap={{ scale: 0.97 }}
          className="flex items-center gap-3 p-3 rounded-2xl bg-oasis-card border border-oasis-border hover:bg-oasis-card-hover transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-oasis-card-hover shrink-0 overflow-hidden">
            {product.image_url && !imageError ? (
              <img
                src={product.image_url}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="text-lg">{categoryIcons[product.category] || "📦"}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-oasis-text truncate">
              {product.name}
            </h3>
            <p className="text-xs text-oasis-muted mt-0.5">{product.brand}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-oasis-green/10 text-oasis-green font-medium">
                {product.category}
              </span>
              {isOFF && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20">
                  OFF
                </span>
              )}
            </div>
          </div>
          {!isOFF ? (
            <ScoreRing score={product.safety_score} grade={product.grade} size="sm" animate={false} />
          ) : (
            <div className="w-14 h-14 rounded-full border border-oasis-border flex items-center justify-center">
              <span className="text-[10px] text-oasis-muted font-medium">Tap to<br/>analyze</span>
            </div>
          )}
        </motion.div>
      </Link>
    </motion.div>
  );
}

export function ProductCardHorizontal({ product }: { product: Product }) {
  const [imageError, setImageError] = useState(false);

  return (
    <Link href={`/product/${product.id}`}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        className="w-36 shrink-0 p-3 rounded-2xl bg-oasis-card border border-oasis-border hover:bg-oasis-card-hover transition-colors"
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-oasis-card-hover overflow-hidden">
            {product.image_url && !imageError ? (
              <img
                src={product.image_url}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <span className="text-2xl">{categoryIcons[product.category] || "📦"}</span>
            )}
          </div>
          <ScoreRing score={product.safety_score} grade={product.grade} size="sm" animate={false} />
        </div>
        <h3 className="text-xs font-semibold text-oasis-text truncate">
          {product.name}
        </h3>
        <p className="text-[10px] text-oasis-muted mt-0.5">
          {product.brand}
        </p>
      </motion.div>
    </Link>
  );
}
