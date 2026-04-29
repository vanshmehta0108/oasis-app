"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { EditorialIssue } from "@/lib/editorial";
import type { VerdictTone } from "@/lib/verdict";

// Editorial card — the "magazine slot" on home. Tone color matches the
// verdict palette so the visual language stays cohesive: a "skip" issue
// reads in the same warm orange as a "we'd skip it" verdict.
const TONE_COLORS: Record<VerdictTone, { accent: string; bg: string; chip: string; chipText: string }> = {
  clean:      { accent: "#00875A", bg: "#E8F7F0", chip: "#CFEBDC", chipText: "#005C3C" },
  mostly:     { accent: "#1E8040", bg: "#F0FBF4", chip: "#D7F0DF", chipText: "#125428" },
  occasional: { accent: "#B87800", bg: "#FFF8E6", chip: "#FBE7B8", chipText: "#7A4F00" },
  skip:       { accent: "#CC5200", bg: "#FFF2E8", chip: "#FCD8BB", chipText: "#8A3700" },
  avoid:      { accent: "#CC1010", bg: "#FFF0EE", chip: "#FBCFCB", chipText: "#8A0A0A" },
};

export function EditorialCard({ issue }: { issue: EditorialIssue }) {
  const palette = TONE_COLORS[issue.tone];

  return (
    <Link href={issue.href} aria-label={`${issue.kicker} — ${issue.headline}`}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: palette.bg,
          boxShadow: `0 1px 2px rgba(0,0,0,0.04), 0 12px 32px -16px ${palette.accent}40`,
        }}
      >
        <div className="px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[10px] font-bold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full"
              style={{ background: palette.chip, color: palette.chipText }}
            >
              {issue.tag}
            </span>
            <ArrowUpRight size={16} style={{ color: palette.accent }} />
          </div>

          <p
            className="text-[11px] font-semibold tracking-wider uppercase mb-1.5"
            style={{ color: palette.accent }}
          >
            {issue.kicker}
          </p>
          <h3 className="text-[20px] font-bold leading-[1.18] tracking-[-0.01em] text-black mb-2">
            {issue.headline}
          </h3>
          <p className="text-[13px] leading-relaxed text-black/65 mb-4">
            {issue.subhead}
          </p>

          <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: palette.accent }}>
            {issue.cta}
            <ArrowUpRight size={14} />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
