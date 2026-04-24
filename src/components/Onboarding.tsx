"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Plus, X } from "lucide-react";
import { useUserData } from "@/lib/userData";

const HEALTH_CONDITIONS = [
  { id: "diabetic",  label: "Diabetic",           emoji: "💉" },
  { id: "pregnant",  label: "Pregnant",            emoji: "🤰" },
  { id: "lactose",   label: "Lactose Intolerant",  emoji: "🥛" },
  { id: "gluten",    label: "Gluten Sensitive",     emoji: "🌾" },
  { id: "heart",     label: "Heart Condition",      emoji: "❤️" },
  { id: "bp",        label: "High BP",              emoji: "🩺" },
  { id: "thyroid",   label: "Thyroid",              emoji: "🦋" },
  { id: "pcod",      label: "PCOD / PCOS",          emoji: "🩷" },
] as const;

const COMMON_ALLERGIES = ["Peanuts", "Milk", "Gluten", "Soy", "Eggs", "Tree Nuts", "Shellfish", "Sulfites"] as const;

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 280 : -280, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (d: number) => ({ x: d > 0 ? -280 : 280, opacity: 0 }),
};

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 px-6">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="h-1 rounded-full flex-1"
          animate={{ background: i <= current ? "#007AFF" : "#E5E5EA" }}
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  );
}

export function Onboarding({ onComplete }: { onComplete: () => void | Promise<void> }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState("");
  const [saving, setSaving] = useState(false);
  const { setProfile } = useUserData();
  const totalSteps = 4;

  const goNext = useCallback(() => { setDirection(1); setStep((s) => Math.min(s + 1, totalSteps - 1)); }, []);

  const finish = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    // Save labels (not IDs) so Profile page's healthConditions.name comparison works
    const conditionLabels = conditions.map(
      (id) => HEALTH_CONDITIONS.find((h) => h.id === id)?.label ?? id
    );
    try {
      await setProfile({ conditions: conditionLabels, allergies });
    } catch {
      // Proceed even if the write fails — onboarding shouldn't block the user.
    }
    await onComplete();
  }, [conditions, allergies, onComplete, setProfile, saving]);

  const skip = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await setProfile({ conditions: [], allergies: [] });
    } catch {}
    await onComplete();
  }, [onComplete, setProfile, saving]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col min-h-dvh"
      style={{ background: "#F2F2F7" }}
    >
      {/* Skip */}
      <div className="flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <button onClick={skip} className="text-[14px] font-medium" style={{ color: "#007AFF" }}>
          Skip
        </button>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="w-full max-w-sm px-6"
          >
            {step === 0 && <StepWelcome onNext={goNext} />}
            {step === 1 && <StepHealth conditions={conditions} onToggle={(id) => setConditions((p) => p.includes(id) ? p.filter((c) => c !== id) : [...p, id])} onNext={goNext} />}
            {step === 2 && <StepAllergies allergies={allergies} onToggle={(n) => setAllergies((p) => p.includes(n) ? p.filter((a) => a !== n) : [...p, n])} customAllergy={customAllergy} onCustomChange={setCustomAllergy} onAddCustom={() => { const t = customAllergy.trim(); if (t && !allergies.includes(t)) { setAllergies((p) => [...p, t]); setCustomAllergy(""); } }} onNext={goNext} />}
            {step === 3 && <StepReady conditions={conditions} allergies={allergies} onFinish={finish} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress */}
      <div className="pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        <ProgressBar current={step} total={totalSteps} />
      </div>
    </div>
  );
}

/* ── Welcome ── */
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        className="w-20 h-20 rounded-[22px] flex items-center justify-center mx-auto mb-8"
        style={{ background: "#007AFF", boxShadow: "0 8px 24px rgba(0,122,255,0.3)" }}
      >
        <span className="text-white text-3xl font-bold tracking-tight">S</span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.45 }}
        className="text-[32px] font-bold text-black tracking-tight mb-3"
      >
        Welcome to Sift
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32, duration: 0.4 }}
        className="text-[16px] leading-relaxed mb-1"
        style={{ color: "#3C3C43" }}
      >
        Know what&apos;s really in your food.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.4 }}
        className="text-[14px] mb-12"
        style={{ color: "#8E8E93" }}
      >
        India&apos;s AI-powered ingredient scanner
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.52, duration: 0.4 }}
        whileTap={{ scale: 0.96 }}
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 py-[15px] rounded-2xl text-white font-semibold text-[16px]"
        style={{ background: "#007AFF" }}
      >
        Get Started
        <ChevronRight size={18} strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}

/* ── Health ── */
function StepHealth({ conditions, onToggle, onNext }: { conditions: string[]; onToggle: (id: string) => void; onNext: () => void }) {
  return (
    <div>
      <h2 className="text-[26px] font-bold text-black text-center mb-1.5 tracking-tight">What matters to you?</h2>
      <p className="text-[14px] text-center mb-6" style={{ color: "#8E8E93" }}>
        Select any health conditions for personalised warnings.
      </p>

      <div className="grid grid-cols-2 gap-2.5 mb-8">
        {HEALTH_CONDITIONS.map((c) => {
          const sel = conditions.includes(c.id);
          return (
            <motion.button
              key={c.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => onToggle(c.id)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl text-left transition-all"
              style={{
                background: sel ? "#EBF3FF" : "#FFFFFF",
                border: sel ? "1.5px solid #007AFF" : "1.5px solid #E5E5EA",
                color: sel ? "#007AFF" : "#000000",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <span className="text-xl">{c.emoji}</span>
              <span className="text-[13px] font-medium">{c.label}</span>
            </motion.button>
          );
        })}
      </div>

      <CTAButton label="Next" onPress={onNext} />
      <SkipLink onPress={onNext} />
    </div>
  );
}

/* ── Allergies ── */
function StepAllergies({ allergies, onToggle, customAllergy, onCustomChange, onAddCustom, onNext }: {
  allergies: string[]; onToggle: (n: string) => void;
  customAllergy: string; onCustomChange: (v: string) => void;
  onAddCustom: () => void; onNext: () => void;
}) {
  return (
    <div>
      <h2 className="text-[26px] font-bold text-black text-center mb-1.5 tracking-tight">Any allergies?</h2>
      <p className="text-[14px] text-center mb-6" style={{ color: "#8E8E93" }}>
        We&apos;ll flag products containing these ingredients.
      </p>

      <div className="flex flex-wrap gap-2 justify-center mb-5">
        {COMMON_ALLERGIES.map((a) => {
          const sel = allergies.includes(a);
          return (
            <motion.button
              key={a}
              whileTap={{ scale: 0.94 }}
              onClick={() => onToggle(a)}
              className="px-4 py-2 rounded-full text-[13px] font-medium transition-all"
              style={{
                background: sel ? "#EBF3FF" : "#FFFFFF",
                border: sel ? "1.5px solid #007AFF" : "1.5px solid #E5E5EA",
                color: sel ? "#007AFF" : "#000000",
              }}
            >
              {a}
            </motion.button>
          );
        })}
      </div>

      {/* Custom pills */}
      {allergies.filter((a) => !COMMON_ALLERGIES.includes(a as typeof COMMON_ALLERGIES[number])).length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {allergies.filter((a) => !COMMON_ALLERGIES.includes(a as typeof COMMON_ALLERGIES[number])).map((a) => (
            <motion.button
              key={a}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => onToggle(a)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium"
              style={{ background: "#EBF3FF", border: "1.5px solid #007AFF", color: "#007AFF" }}
            >
              {a} <X size={13} />
            </motion.button>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-8">
        <input
          type="text"
          value={customAllergy}
          onChange={(e) => onCustomChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAddCustom()}
          placeholder="Add custom allergy…"
          className="flex-1 px-4 py-3 rounded-2xl text-[14px] text-black placeholder:text-[#C7C7CC] focus:outline-none"
          style={{ background: "#FFFFFF", border: "1.5px solid #E5E5EA" }}
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onAddCustom}
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: "#EBF3FF" }}
        >
          <Plus size={18} style={{ color: "#007AFF" }} />
        </motion.button>
      </div>

      <CTAButton label="Next" onPress={onNext} />
      <SkipLink onPress={onNext} />
    </div>
  );
}

/* ── Ready ── */
function StepReady({ conditions, allergies, onFinish }: { conditions: string[]; allergies: string[]; onFinish: () => void }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
        style={{ background: "#EBF3FF", border: "2px solid rgba(0,122,255,0.25)" }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="M5 13l4 4L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }} />
        </svg>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-[28px] font-bold text-black tracking-tight mb-2"
      >
        You&apos;re all set!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-[14px] leading-relaxed mb-8 max-w-[260px] mx-auto"
        style={{ color: "#8E8E93" }}
      >
        Sift will warn you about ingredients that affect your health.
      </motion.p>

      {(conditions.length > 0 || allergies.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8 p-4 rounded-2xl text-left"
          style={{ background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}
        >
          {conditions.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#8E8E93" }}>Conditions</p>
              <div className="flex flex-wrap gap-1.5">
                {conditions.map((id) => {
                  const c = HEALTH_CONDITIONS.find((h) => h.id === id);
                  return c ? (
                    <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium" style={{ background: "#EBF3FF", color: "#007AFF" }}>
                      {c.emoji} {c.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
          {allergies.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#8E8E93" }}>Allergies</p>
              <div className="flex flex-wrap gap-1.5">
                {allergies.map((a) => (
                  <span key={a} className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium" style={{ background: "rgba(255,59,48,0.08)", color: "#FF3B30" }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <CTAButton label="Start Scanning" onPress={onFinish} />
      </motion.div>
    </div>
  );
}

/* ── Shared sub-components ── */
function CTAButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onPress}
      className="w-full flex items-center justify-center gap-2 py-[15px] rounded-2xl text-white font-semibold text-[16px]"
      style={{ background: "#007AFF" }}
    >
      {label}
      <ChevronRight size={18} strokeWidth={2.5} />
    </motion.button>
  );
}

function SkipLink({ onPress }: { onPress: () => void }) {
  return (
    <button onClick={onPress} className="w-full mt-3 py-2 text-[14px] font-medium" style={{ color: "#8E8E93" }}>
      Skip for now
    </button>
  );
}
