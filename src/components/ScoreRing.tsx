"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ScoreRingProps {
  score: number | null;
  grade: string | null;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

const sizeMap = {
  sm: { dim: 52, stroke: 4,  fontSize: "text-sm",   gradeSize: "text-[9px]"  },
  md: { dim: 88, stroke: 5,  fontSize: "text-2xl",  gradeSize: "text-[11px]" },
  lg: { dim: 156, stroke: 7, fontSize: "text-5xl",  gradeSize: "text-sm"     },
};

function getScoreColor(score: number) {
  if (score >= 80) return "#34C759"; // A — safe
  if (score >= 60) return "#FF9F0A"; // B — moderate
  if (score >= 40) return "#FF6B00"; // C — concerning
  return "#FF3B30";                   // D/E — unsafe
}

function getGradeLabel(score: number) {
  if (score >= 80) return "Safe";
  if (score >= 60) return "Moderate";
  if (score >= 40) return "Concerning";
  return "Unsafe";
}

export function ScoreRing({ score, grade, size = "md", animate = true }: ScoreRingProps) {
  const hasScore = score != null;
  const safeScore = score ?? 0;
  const safeGrade = grade ?? "?";
  const [displayScore, setDisplayScore] = useState(animate ? 0 : safeScore);
  const cfg = sizeMap[size];
  const radius = (cfg.dim - cfg.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = hasScore ? getScoreColor(safeScore) : "#E5E5EA";
  const offset = hasScore ? circumference - (displayScore / 100) * circumference : circumference;

  useEffect(() => {
    if (!animate) return;
    let frame: number;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * safeScore));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [safeScore, animate]);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: cfg.dim, height: cfg.dim }}
      role="img"
      aria-label={hasScore ? `Safety score: ${safeScore} out of 100, Grade ${safeGrade} — ${getGradeLabel(safeScore)}` : "Not yet scored"}
    >
      <svg width={cfg.dim} height={cfg.dim} className="-rotate-90" aria-hidden="true">
        {/* Track */}
        <circle
          cx={cfg.dim / 2}
          cy={cfg.dim / 2}
          r={radius}
          fill="none"
          stroke="#E5E5EA"
          strokeWidth={cfg.stroke}
        />
        {/* Fill */}
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
          transition={{ duration: 1.2, ease: [0.33, 1, 0.68, 1] }}
        />
      </svg>

      {/* Score + grade */}
      <div className="absolute flex flex-col items-center" aria-hidden="true">
        <span
          className={`${cfg.fontSize} font-bold leading-none tabular-nums`}
          style={{ color: hasScore ? color : "#C7C7CC" }}
        >
          {hasScore ? displayScore : "—"}
        </span>
        <span className={`${cfg.gradeSize} font-semibold mt-0.5`} style={{ color: "#8E8E93" }}>
          {hasScore ? safeGrade : "?"}
        </span>
      </div>
    </div>
  );
}
