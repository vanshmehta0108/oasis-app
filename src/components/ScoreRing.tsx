"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ScoreRingProps {
  score: number;
  grade: string;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

const sizeMap = {
  sm: { dim: 56, stroke: 4, fontSize: "text-sm", gradeSize: "text-[10px]", glow: 4 },
  md: { dim: 96, stroke: 5, fontSize: "text-2xl", gradeSize: "text-xs", glow: 8 },
  lg: { dim: 168, stroke: 7, fontSize: "text-5xl", gradeSize: "text-base", glow: 16 },
};

function getColor(score: number) {
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#a3e635";
  if (score >= 40) return "#fbbf24";
  if (score >= 20) return "#fb923c";
  return "#f87171";
}

export function ScoreRing({ score, grade, size = "md", animate = true }: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);
  const cfg = sizeMap[size];
  const radius = (cfg.dim - cfg.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = getColor(score);

  useEffect(() => {
    if (!animate) return;
    let frame: number;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score, animate]);

  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: cfg.dim, height: cfg.dim }}
      role="img"
      aria-label={`Safety score: ${score} out of 100, Grade ${grade}`}
    >
      {/* Outer glow halo for lg */}
      {size === "lg" && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color}15 0%, ${color}08 40%, transparent 70%)`,
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.4, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      )}

      {/* Medium glow for md */}
      {size === "md" && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color}10 0%, transparent 70%)`,
            transform: "scale(1.2)",
          }}
        />
      )}

      <svg width={cfg.dim} height={cfg.dim} className="-rotate-90" aria-hidden="true">
        {/* Background track */}
        <circle
          cx={cfg.dim / 2}
          cy={cfg.dim / 2}
          r={radius}
          fill="none"
          stroke="#1e2e25"
          strokeWidth={cfg.stroke}
          opacity={0.6}
        />
        {/* Score arc */}
        <motion.circle
          cx={cfg.dim / 2}
          cy={cfg.dim / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.33, 1, 0.68, 1] as const }}
          style={{
            filter: `drop-shadow(0 0 ${cfg.glow}px ${color}60)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center" aria-hidden="true">
        <span
          className={`${cfg.fontSize} font-bold leading-none`}
          style={{
            color,
            textShadow: `0 0 ${cfg.glow * 2}px ${color}30`,
          }}
        >
          {displayScore}
        </span>
        <span className={`${cfg.gradeSize} font-medium text-oasis-muted mt-0.5`}>
          {grade}
        </span>
      </div>
    </div>
  );
}
