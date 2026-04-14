"use client";

import { motion } from "framer-motion";

export function SkeletonLine({ width = "100%", height = "12px" }: { width?: string; height?: string }) {
  return (
    <div
      className="shimmer rounded-lg"
      style={{ width, height }}
    />
  );
}

export function SkeletonProductCard() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-oasis-card border border-oasis-border">
      <div className="w-10 h-10 rounded-xl shimmer shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonLine width="60%" height="14px" />
        <SkeletonLine width="30%" height="10px" />
      </div>
      <div className="w-12 h-12 rounded-full shimmer shrink-0" />
    </div>
  );
}

export function SkeletonScoreHero() {
  return (
    <div className="flex flex-col items-center pt-20 pb-5">
      <div className="w-[168px] h-[168px] rounded-full shimmer mb-4" />
      <SkeletonLine width="200px" height="20px" />
      <div className="mt-2">
        <SkeletonLine width="80px" height="12px" />
      </div>
    </div>
  );
}

export function SkeletonSearchResults() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-2"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonProductCard key={i} />
      ))}
    </motion.div>
  );
}
