"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, ShieldCheck, AlertTriangle, ShieldAlert,
  FileText, Brain, Globe, Calculator, CheckCircle2, XCircle,
} from "lucide-react";

const bands = [
  { range: "80 – 100", label: "Safe", color: "#1E8040", bg: "#F0FBF4", blurb: "Clean ingredient list, minimal processing, no concerning additives. Recommended." },
  { range: "60 – 79",  label: "Moderate", color: "#B87800", bg: "#FFF8E6", blurb: "Mostly safe with one or two minor concerns. Consider alternatives for daily use." },
  { range: "40 – 59",  label: "Concerning", color: "#CC5200", bg: "#FFF2E8", blurb: "Multiple issues — high sodium/sugar, synthetic additives, or borderline additive levels." },
  { range: "20 – 39",  label: "Unsafe", color: "#CC1010", bg: "#FFF0EE", blurb: "Significant concerns — synthetic dyes, high trans fat, misleading labels, or additives above FSSAI recommendations." },
  { range: "0 – 19",   label: "Dangerous", color: "#991010", bg: "#FFE3E3", blurb: "Banned or heavily restricted substances, severely misleading claims, or multiple serious violations." },
];

const deductions = [
  { reason: "FSSAI not detected / unregistered", range: "−5 to −10", severity: "warning" as const },
  { reason: "Banned substance (e.g. BVO, potassium bromate)", range: "−30 to −60", severity: "danger" as const },
  { reason: "EU-banned dye still allowed by FSSAI (e.g. INS 171)", range: "−10 to −25", severity: "danger" as const },
  { reason: "Additive above typical safe level (INS 102, 110, 211, 621)", range: "−10 to −20", severity: "warning" as const },
  { reason: "Palm oil / partially hydrogenated oils", range: "−8 to −15", severity: "warning" as const },
  { reason: "Added sugar > 10% of 25g/day WHO limit", range: "−8 to −20", severity: "caution" as const },
  { reason: "Sodium > 20% of 5g/day WHO limit", range: "−5 to −15", severity: "caution" as const },
  { reason: "Artificial sweetener (INS 951, 950)", range: "−5 to −10", severity: "caution" as const },
  { reason: "Refined maida as primary ingredient", range: "−5 to −10", severity: "caution" as const },
  { reason: "Misleading 'natural' / 'no added sugar' claim", range: "−3 to −8", severity: "warning" as const },
];

const bonuses = [
  { reason: "FSSAI license verified online", range: "+3", icon: ShieldCheck },
  { reason: "Whole-food ingredients, recognizable names", range: "+3 to +5", icon: CheckCircle2 },
  { reason: "No artificial colors, flavors, or preservatives", range: "+3 to +7", icon: CheckCircle2 },
  { reason: "FSSAI 'no added sugar' compliant", range: "+2", icon: CheckCircle2 },
];

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function ScoringPage() {
  return (
    <div className="min-h-dvh pb-24" style={{ background: "#F2F2F7" }}>
      <div className="max-w-lg mx-auto px-5 pt-14">
        <div className="fixed top-4 left-4 z-50">
          <Link href="/" aria-label="Go back to home">
            <motion.div
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-full glass-light border border-black/[0.08]"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              <span className="text-xs font-medium">Back</span>
            </motion.div>
          </Link>
        </div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={stagger}
          className="space-y-6"
        >
          {/* Hero */}
          <motion.div variants={fadeUp}>
            <h1 className="text-[30px] font-bold text-black tracking-tight leading-tight">How we score</h1>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "#3C3C43" }}>
              Every product gets a single 0–100 safety score. This page explains exactly how that number is calculated, what it includes, and — honestly — what it doesn&apos;t.
            </p>
          </motion.div>

          {/* TL;DR */}
          <motion.div variants={fadeUp} className="p-4 rounded-2xl bg-white border border-black/[0.06]" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Brain size={16} className="text-[#007AFF]" />
              <h2 className="text-[15px] font-semibold text-black">In one paragraph</h2>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "#3C3C43" }}>
              We send the product&apos;s ingredient list and category to Google&apos;s Gemini 2.5 Flash model with a prompt loaded with FSSAI additive limits, WHO/ICMR dietary guidelines, and India-specific context (diabetes prevalence, lactose intolerance, vegetarian dietary norms). The model deducts points from 100 for each concerning ingredient based on a rubric below, adds bonuses for transparency, then we clamp to 0–100 and convert to a letter grade.
            </p>
          </motion.div>

          {/* Score bands */}
          <motion.section variants={fadeUp}>
            <h2 className="text-[17px] font-semibold text-black mb-3">Score bands</h2>
            <div className="space-y-2">
              {bands.map((b) => (
                <div
                  key={b.label}
                  className="p-3.5 rounded-2xl border border-black/[0.06]"
                  style={{ background: b.bg }}
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 w-[72px] text-center">
                      <div className="text-[13px] font-bold tabular-nums" style={{ color: b.color }}>{b.range}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: b.color }}>{b.label}</div>
                    </div>
                    <p className="text-[12px] leading-snug flex-1" style={{ color: "#3C3C43" }}>{b.blurb}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Inputs */}
          <motion.section variants={fadeUp}>
            <h2 className="text-[17px] font-semibold text-black mb-3">What goes in</h2>
            <div className="p-4 rounded-2xl bg-white border border-black/[0.06] space-y-3">
              <InputRow icon={FileText} title="Ingredient list" body="Parsed from the product barcode lookup (Open Food Facts, our community DB) or extracted from a photo of the label using Gemini vision." />
              <InputRow icon={Calculator} title="INS numbers + typical dose" body="Gemini identifies every additive by its INS/E number and compares against FSSAI's permitted limit for that category." />
              <InputRow icon={Globe} title="FSSAI registration" body="We look up the 14-digit FSSAI license online. Missing or invalid license deducts points and surfaces a 'FSSAI Not Verified' badge." />
              <InputRow icon={ShieldAlert} title="India-specific risk flags" body="Palm oil, high sodium/sugar, hidden non-veg (E120, gelatin, L-cysteine), lead in kajal — all weighted more heavily here than they would be in a Western-focused app." />
            </div>
          </motion.section>

          {/* Deductions */}
          <motion.section variants={fadeUp}>
            <h2 className="text-[17px] font-semibold text-black mb-1">Penalties</h2>
            <p className="text-[12px] mb-3" style={{ color: "#8E8E93" }}>
              Every product starts at 100 and loses points for each of these. Ranges reflect the model&apos;s judgment on severity within the category.
            </p>
            <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden">
              {deductions.map((d, i) => {
                const color = d.severity === "danger" ? "#CC1010" : d.severity === "warning" ? "#CC5200" : "#B87800";
                return (
                  <div key={d.reason} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-black/[0.04]" : ""}`}>
                    <AlertTriangle size={14} style={{ color }} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-black leading-snug">{d.reason}</p>
                    </div>
                    <span className="text-[12px] font-bold tabular-nums shrink-0" style={{ color }}>{d.range}</span>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* Bonuses */}
          <motion.section variants={fadeUp}>
            <h2 className="text-[17px] font-semibold text-black mb-1">Bonuses</h2>
            <p className="text-[12px] mb-3" style={{ color: "#8E8E93" }}>
              Products that are transparent and clean claw back some points.
            </p>
            <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden">
              {bonuses.map((b, i) => {
                const Icon = b.icon;
                return (
                  <div key={b.reason} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-black/[0.04]" : ""}`}>
                    <Icon size={14} className="text-[#1E8040] shrink-0" />
                    <p className="text-[13px] text-black flex-1 min-w-0">{b.reason}</p>
                    <span className="text-[12px] font-bold text-[#1E8040] tabular-nums shrink-0">{b.range}</span>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* Personalization */}
          <motion.section variants={fadeUp}>
            <h2 className="text-[17px] font-semibold text-black mb-1">Personalization</h2>
            <p className="text-[12px] mb-3" style={{ color: "#8E8E93" }}>
              If you set health conditions and allergies in your Profile, a second pass checks each ingredient against your profile and surfaces a &ldquo;Warnings for You&rdquo; card above the generic summary. The base score doesn&apos;t change — we never show you a different 0–100 than we&apos;d show anyone else — but the warnings are yours.
            </p>
            <div className="p-4 rounded-2xl bg-white border border-black/[0.06] text-[12px] space-y-2" style={{ color: "#3C3C43" }}>
              <p><strong>Diabetes:</strong> flags sugar, maida, high-GI ingredients, maltodextrin.</p>
              <p><strong>Hypertension / Heart condition:</strong> flags sodium, MSG (INS 621), trans fats.</p>
              <p><strong>Lactose intolerance:</strong> flags milk solids, whey, casein.</p>
              <p><strong>Celiac / gluten sensitivity:</strong> flags wheat, barley, rye, maida, sooji.</p>
              <p><strong>PKU:</strong> flags aspartame (INS 951).</p>
              <p><strong>Kidney disease:</strong> flags potassium, phosphorus additives (INS 338-341, 450-452).</p>
            </div>
          </motion.section>

          {/* What we don't do */}
          <motion.section variants={fadeUp}>
            <h2 className="text-[17px] font-semibold text-black mb-1">What the score doesn&apos;t include</h2>
            <p className="text-[12px] mb-3" style={{ color: "#8E8E93" }}>
              We&apos;d rather be honest about limits than pretend the score covers everything.
            </p>
            <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden">
              {[
                "Independent lab testing for contaminants (heavy metals, pesticides, PFAS). We don't currently run or source lab data for Indian products — scores are based on declared ingredients only.",
                "Packaging safety (BPA, phthalates). Flagged qualitatively when visible on the label but not deducted numerically.",
                "Batch-level variation. Two packets of the same product can have slightly different ingredient proportions; we score the declared recipe.",
                "Sourcing and sustainability. A score doesn't reflect farm practices, carbon footprint, or fair trade.",
              ].map((note, i) => (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-black/[0.04]" : ""}`}>
                  <XCircle size={14} className="text-oasis-muted shrink-0 mt-0.5" />
                  <p className="text-[13px] leading-snug" style={{ color: "#3C3C43" }}>{note}</p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* Sources */}
          <motion.section variants={fadeUp}>
            <h2 className="text-[17px] font-semibold text-black mb-1">Sources</h2>
            <p className="text-[12px] mb-3" style={{ color: "#8E8E93" }}>
              The rubric the AI follows is loaded from these.
            </p>
            <div className="p-4 rounded-2xl bg-white border border-black/[0.06] text-[12px] space-y-1.5" style={{ color: "#3C3C43" }}>
              <p>• FSSAI (Food Safety and Standards Authority of India) — Food Product Standards and Food Additives Regulations, 2011.</p>
              <p>• WHO Guidelines — sugar &lt; 25 g/day free sugars, sodium &lt; 5 g/day, trans fat &lt; 1% of energy.</p>
              <p>• ICMR-NIN RDA 2020 for the Indian population.</p>
              <p>• FSSAI 2022 ban on partially hydrogenated oils.</p>
              <p>• BIS IS 4707 for cosmetic ingredient standards.</p>
              <p>• Open Food Facts and the product&apos;s own label as the ingredient source of truth.</p>
            </div>
          </motion.section>

          {/* Disagreement */}
          <motion.section variants={fadeUp}>
            <div className="p-4 rounded-2xl bg-[#007AFF]/08 border border-[#007AFF]/20">
              <h2 className="text-[15px] font-semibold text-black mb-1">Disagree with a score?</h2>
              <p className="text-[12px] leading-relaxed mb-3" style={{ color: "#3C3C43" }}>
                Tap &ldquo;Report an issue&rdquo; on any product page. We read every report and re-run the analysis when the feedback is specific (wrong ingredient, outdated label, missed certification).
              </p>
              <Link
                href="/scan"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#007AFF] text-white text-[13px] font-semibold"
              >
                Scan a product
              </Link>
            </div>
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}

function InputRow({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-[#007AFF]" />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-black">{title}</p>
        <p className="text-[12px] leading-snug mt-0.5" style={{ color: "#3C3C43" }}>{body}</p>
      </div>
    </div>
  );
}
