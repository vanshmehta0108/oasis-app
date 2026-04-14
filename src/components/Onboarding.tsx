"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Plus, X } from "lucide-react";

const HEALTH_CONDITIONS = [
  { id: "diabetic", label: "Diabetic", emoji: "\ud83d\udc89" },
  { id: "pregnant", label: "Pregnant", emoji: "\ud83e\udd30" },
  { id: "lactose", label: "Lactose Intolerant", emoji: "\ud83e\udd5b" },
  { id: "gluten", label: "Gluten Sensitive", emoji: "\ud83c\udf3e" },
  { id: "heart", label: "Heart Condition", emoji: "\u2764\ufe0f" },
  { id: "bp", label: "High BP", emoji: "\ud83e\ude7a" },
  { id: "thyroid", label: "Thyroid", emoji: "\ud83e\udd8b" },
  { id: "pcod", label: "PCOD/PCOS", emoji: "\ud83c\udf80" },
] as const;

const COMMON_ALLERGIES = [
  "Peanuts",
  "Milk",
  "Gluten",
  "Soy",
  "Eggs",
  "Tree Nuts",
  "Shellfish",
  "Sulfites",
] as const;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

const slideTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{
            width: i === current ? 24 : 8,
            height: 8,
            backgroundColor: i === current ? "#4ade80" : "#1e2e25",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        />
      ))}
    </div>
  );
}

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState("");

  const totalSteps = 4;

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }, []);

  const finish = useCallback(() => {
    const profile = { conditions, allergies };
    localStorage.setItem("oasis-profile", JSON.stringify(profile));
    onComplete();
  }, [conditions, allergies, onComplete]);

  const toggleCondition = (id: string) => {
    setConditions((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleAllergy = (name: string) => {
    setAllergies((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const addCustomAllergy = () => {
    const trimmed = customAllergy.trim();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies((prev) => [...prev, trimmed]);
      setCustomAllergy("");
    }
  };

  const skip = () => {
    localStorage.setItem("oasis-profile", JSON.stringify({ conditions: [], allergies: [] }));
    onComplete();
  };

  return (
    <div className="gradient-mesh fixed inset-0 z-50 flex flex-col min-h-dvh">
      {/* Skip button */}
      <div className="flex justify-end px-5 pt-4">
        <button
          onClick={skip}
          className="text-xs text-oasis-muted hover:text-oasis-text transition-colors py-1 px-3"
        >
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
            transition={slideTransition}
            className="w-full max-w-md px-6"
          >
            {step === 0 && <StepWelcome onNext={goNext} />}
            {step === 1 && (
              <StepHealth
                conditions={conditions}
                onToggle={toggleCondition}
                onNext={goNext}
              />
            )}
            {step === 2 && (
              <StepAllergies
                allergies={allergies}
                onToggle={toggleAllergy}
                customAllergy={customAllergy}
                onCustomChange={setCustomAllergy}
                onAddCustom={addCustomAllergy}
                onNext={goNext}
              />
            )}
            {step === 3 && (
              <StepReady
                conditions={conditions}
                allergies={allergies}
                onFinish={finish}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <ProgressDots current={step} total={totalSteps} />
    </div>
  );
}

/* ---------- Step 1: Welcome ---------- */
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
        className="text-7xl mb-6"
      >
        {"\ud83c\udf3f"}
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="font-[family-name:var(--font-instrument)] text-4xl text-oasis-text mb-3"
      >
        Welcome to Oasis
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="text-base text-oasis-text/80 mb-1.5"
      >
        Know what&apos;s really in your food.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="text-sm text-oasis-muted mb-10"
      >
        India&apos;s AI-powered safety scanner
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        whileTap={{ scale: 0.96 }}
        onClick={onNext}
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-oasis-green text-oasis-black font-bold text-[15px] pulse-glow"
      >
        Get Started
        <ChevronRight size={18} strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}

/* ---------- Step 2: Health Profile ---------- */
function StepHealth({
  conditions,
  onToggle,
  onNext,
}: {
  conditions: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-instrument)] text-3xl text-oasis-text text-center mb-2">
        What matters to you?
      </h2>
      <p className="text-sm text-oasis-muted text-center mb-6">
        Select any health conditions so we can personalize your warnings.
      </p>

      <div className="grid grid-cols-2 gap-2.5 mb-8">
        {HEALTH_CONDITIONS.map((c) => {
          const selected = conditions.includes(c.id);
          return (
            <motion.button
              key={c.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onToggle(c.id)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-left transition-colors ${
                selected
                  ? "bg-oasis-green/10 border-oasis-green/30 text-oasis-green"
                  : "bg-oasis-card border-oasis-border text-oasis-muted"
              }`}
            >
              <span className="text-xl">{c.emoji}</span>
              <span className="text-[13px] font-medium">{c.label}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onNext}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-oasis-green text-oasis-black font-bold text-[15px]"
        >
          Next
          <ChevronRight size={18} strokeWidth={2.5} />
        </motion.button>
        <button
          onClick={onNext}
          className="text-xs text-oasis-muted hover:text-oasis-text transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

/* ---------- Step 3: Allergies ---------- */
function StepAllergies({
  allergies,
  onToggle,
  customAllergy,
  onCustomChange,
  onAddCustom,
  onNext,
}: {
  allergies: string[];
  onToggle: (name: string) => void;
  customAllergy: string;
  onCustomChange: (v: string) => void;
  onAddCustom: () => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-instrument)] text-3xl text-oasis-text text-center mb-2">
        Any allergies?
      </h2>
      <p className="text-sm text-oasis-muted text-center mb-6">
        We&apos;ll flag products containing these ingredients.
      </p>

      <div className="flex flex-wrap gap-2 justify-center mb-5">
        {COMMON_ALLERGIES.map((a) => {
          const selected = allergies.includes(a);
          return (
            <motion.button
              key={a}
              whileTap={{ scale: 0.93 }}
              onClick={() => onToggle(a)}
              className={`px-4 py-2 rounded-full border text-[13px] font-medium transition-colors ${
                selected
                  ? "bg-oasis-green/10 border-oasis-green/30 text-oasis-green"
                  : "bg-oasis-card border-oasis-border text-oasis-muted"
              }`}
            >
              {a}
            </motion.button>
          );
        })}
      </div>

      {/* Custom allergy pills already added */}
      {allergies.filter((a) => !COMMON_ALLERGIES.includes(a as typeof COMMON_ALLERGIES[number])).length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {allergies
            .filter((a) => !COMMON_ALLERGIES.includes(a as typeof COMMON_ALLERGIES[number]))
            .map((a) => (
              <motion.button
                key={a}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => onToggle(a)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-oasis-green/10 border border-oasis-green/30 text-oasis-green text-[13px] font-medium"
              >
                {a}
                <X size={14} />
              </motion.button>
            ))}
        </div>
      )}

      {/* Custom input */}
      <div className="flex gap-2 max-w-xs mx-auto mb-8">
        <input
          type="text"
          value={customAllergy}
          onChange={(e) => onCustomChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAddCustom()}
          placeholder="Add custom allergy..."
          className="flex-1 px-4 py-2.5 rounded-full bg-oasis-card border border-oasis-border text-oasis-text text-[13px] placeholder:text-oasis-muted/50 focus:outline-none focus:border-oasis-green/40 transition-colors"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onAddCustom}
          className="w-10 h-10 rounded-full bg-oasis-card border border-oasis-border flex items-center justify-center text-oasis-muted hover:text-oasis-green hover:border-oasis-green/30 transition-colors"
        >
          <Plus size={18} />
        </motion.button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onNext}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-oasis-green text-oasis-black font-bold text-[15px]"
        >
          Next
          <ChevronRight size={18} strokeWidth={2.5} />
        </motion.button>
        <button
          onClick={onNext}
          className="text-xs text-oasis-muted hover:text-oasis-text transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

/* ---------- Step 4: Ready ---------- */
function StepReady({
  conditions,
  allergies,
  onFinish,
}: {
  conditions: string[];
  allergies: string[];
  onFinish: () => void;
}) {
  const hasSelections = conditions.length > 0 || allergies.length > 0;

  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-oasis-green/10 border-2 border-oasis-green/30 flex items-center justify-center mx-auto mb-6"
      >
        <motion.svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4ade80"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <motion.path
            d="M5 13l4 4L19 7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
          />
        </motion.svg>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="font-[family-name:var(--font-instrument)] text-3xl text-oasis-text mb-2"
      >
        You&apos;re all set!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="text-sm text-oasis-muted mb-6 max-w-[280px] mx-auto leading-relaxed"
      >
        Oasis will now warn you about ingredients that affect your health.
      </motion.p>

      {hasSelections && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mb-8 p-4 rounded-2xl bg-oasis-card border border-oasis-border text-left max-w-xs mx-auto"
        >
          {conditions.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] text-oasis-muted uppercase tracking-wide font-semibold mb-1.5">
                Conditions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {conditions.map((id) => {
                  const c = HEALTH_CONDITIONS.find((h) => h.id === id);
                  return c ? (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-oasis-green/10 text-oasis-green text-[12px] font-medium"
                    >
                      {c.emoji} {c.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
          {allergies.length > 0 && (
            <div>
              <p className="text-[11px] text-oasis-muted uppercase tracking-wide font-semibold mb-1.5">
                Allergies
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allergies.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center px-2.5 py-1 rounded-full bg-oasis-orange/10 text-oasis-orange text-[12px] font-medium"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        whileTap={{ scale: 0.96 }}
        onClick={onFinish}
        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-oasis-green text-oasis-black font-bold text-[15px] pulse-glow"
      >
        Start Scanning
        <ChevronRight size={18} strokeWidth={2.5} />
      </motion.button>
    </div>
  );
}
