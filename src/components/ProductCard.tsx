"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ScoreRing } from "./ScoreRing";
import type { Product } from "@/lib/mockData";
import { useLanguage } from "./LanguageProvider";
import { t } from "@/lib/i18n";
import {
  UtensilsCrossed, Coffee, Popcorn, Sparkles, Baby,
  Home as HomeIcon, Package
} from "lucide-react";

const categoryConfig: Record<string, { bg: string; color: string; Icon: React.ElementType }> = {
  Food:      { bg: "#FFF3E8", color: "#FF6B00", Icon: UtensilsCrossed },
  Beverages: { bg: "#EBF3FF", color: "#007AFF", Icon: Coffee },
  Snacks:    { bg: "#FFF8E6", color: "#B87800", Icon: Popcorn },
  Skincare:  { bg: "#F5EEFF", color: "#8B5CF6", Icon: Sparkles },
  Baby:      { bg: "#FFF0F5", color: "#FF2D78", Icon: Baby },
  Household: { bg: "#F0FBF4", color: "#1E8040", Icon: HomeIcon },
  food:      { bg: "#FFF3E8", color: "#FF6B00", Icon: UtensilsCrossed },
  beverage:  { bg: "#EBF3FF", color: "#007AFF", Icon: Coffee },
  snack:     { bg: "#FFF8E6", color: "#B87800", Icon: Popcorn },
  skincare:  { bg: "#F5EEFF", color: "#8B5CF6", Icon: Sparkles },
  baby_food: { bg: "#FFF0F5", color: "#FF2D78", Icon: Baby },
  household: { bg: "#F0FBF4", color: "#1E8040", Icon: HomeIcon },
};

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const isOFF = product.id.startsWith("off-");
  const cfg = categoryConfig[product.category];
  const { language } = useLanguage();

  const handleClick = () => {
    if (isOFF) {
      const barcode = product.barcode || product.id.replace("off-", "");
      sessionStorage.setItem(`off-product-${barcode}`, JSON.stringify({ ...product, needs_analysis: true }));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link href={`/product/${product.id}`} onClick={handleClick}>
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 px-4 py-3 bg-white ios-section-row"
        >
          {/* Thumbnail */}
          <div
            className="flex items-center justify-center w-10 h-10 rounded-[10px] shrink-0 overflow-hidden"
            style={{ background: cfg?.bg || "#F2F2F7" }}
          >
            {cfg ? (
              <cfg.Icon size={18} color={cfg.color} />
            ) : (
              <Package size={18} color="#8E8E93" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-black truncate leading-tight">
              {product.name}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "#8E8E93" }}>
              {product.brand}
            </p>
          </div>

          {/* Score */}
          {!isOFF && product.safety_score != null ? (
            <ScoreRing score={product.safety_score} grade={product.grade ?? "?"} size="sm" animate={false} />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "#F2F2F7" }}
            >
              <span className="text-[9px] font-medium text-center leading-tight whitespace-pre-line" style={{ color: "#8E8E93" }}>
                {isOFF ? t('tap_to_analyze', language) : t('not_scored', language)}
              </span>
            </div>
          )}
        </motion.div>
      </Link>
    </motion.div>
  );
}

export function ProductCardHorizontal({ product }: { product: Product }) {
  const cfg = categoryConfig[product.category];
  const { language } = useLanguage();

  return (
    <Link href={`/product/${product.id}`}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        className="w-[140px] shrink-0 rounded-2xl bg-white overflow-hidden"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
      >
        <div className="h-[48px] flex items-center justify-center" style={{ background: cfg?.bg || "#F2F2F7" }}>
          {cfg ? (
            <cfg.Icon size={20} color={cfg.color} />
          ) : (
            <Package size={20} color="#8E8E93" />
          )}
        </div>
        <div className="p-3">
          <div className="flex justify-between items-start mb-1">
            <p className="text-[12px] font-semibold text-black truncate leading-snug flex-1 pr-1">{product.name}</p>
            {product.safety_score != null ? (
              <ScoreRing score={product.safety_score} grade={product.grade ?? "?"} size="sm" animate={false} />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#F2F2F7" }}>
                <span className="text-[8px] font-medium text-center leading-tight whitespace-pre-line" style={{ color: "#8E8E93" }}>{t('not_scored', language)}</span>
              </div>
            )}
          </div>
          <p className="text-[10px]" style={{ color: "#8E8E93" }}>{product.brand}</p>
        </div>
      </motion.div>
    </Link>
  );
}
