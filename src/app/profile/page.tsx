"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Heart, Globe, Crown, History, X, Plus, ScanLine, ShieldCheck, CheckCircle } from "lucide-react";
import Link from "next/link";
import { ScoreRing } from "@/components/ScoreRing";
import { products } from "@/lib/mockData";

const healthConditions = [
  { name: "Diabetic", icon: "💉" },
  { name: "Pregnant", icon: "🤰" },
  { name: "Lactose Intolerant", icon: "🥛" },
  { name: "Gluten Sensitive", icon: "🌾" },
  { name: "Heart Condition", icon: "❤️" },
  { name: "High BP", icon: "🩺" },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.33, 1, 0.68, 1] as const } },
};

export default function ProfilePage() {
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>(["Peanuts"]);
  const [allergyInput, setAllergyInput] = useState("");
  const [language, setLanguage] = useState("English");

  const toggleCondition = (c: string) => {
    setSelectedConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const addAllergy = () => {
    const trimmed = allergyInput.trim();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies((prev) => [...prev, trimmed]);
      setAllergyInput("");
    }
  };

  const recentScans = products.slice(0, 5);
  const safeProducts = products.filter((p) => p.safety_score >= 70).length;

  return (
    <div className="gradient-mesh min-h-dvh">
      <motion.div
        className="px-4 pt-12 pb-24 max-w-lg mx-auto"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {/* Avatar area with gradient bg */}
        <motion.div variants={fadeUp} className="relative mb-6">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-oasis-green/10 via-transparent to-transparent" />
          <div className="relative flex flex-col items-center py-6">
            <div className="w-20 h-20 rounded-full bg-oasis-card border-2 border-oasis-green/20 flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(74,222,128,0.1)]">
              <User size={32} className="text-oasis-green/60" />
            </div>
            <h1 className="font-[family-name:var(--font-instrument)] text-2xl text-oasis-text">
              Your Profile
            </h1>
            <span className="text-xs text-oasis-muted mt-1">Personalize your safety alerts</span>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center p-3 rounded-2xl bg-oasis-card border border-oasis-border">
              <ScanLine size={16} className="text-oasis-green mb-1" />
              <span className="text-lg font-bold text-oasis-text">{products.length}</span>
              <span className="text-[10px] text-oasis-muted">Total Scans</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-2xl bg-oasis-card border border-oasis-border">
              <ShieldCheck size={16} className="text-oasis-green mb-1" />
              <span className="text-lg font-bold text-oasis-text">{products.length}</span>
              <span className="text-[10px] text-oasis-muted">Checked</span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-2xl bg-oasis-card border border-oasis-border">
              <CheckCircle size={16} className="text-emerald-400 mb-1" />
              <span className="text-lg font-bold text-emerald-400">{safeProducts}</span>
              <span className="text-[10px] text-oasis-muted">Safe Picks</span>
            </div>
          </div>
        </motion.div>

        {/* Health Profile */}
        <motion.div variants={fadeUp} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={15} className="text-oasis-green" />
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text">
              Health Conditions
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {healthConditions.map((c) => {
              const active = selectedConditions.includes(c.name);
              return (
                <motion.button
                  key={c.name}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleCondition(c.name)}
                  aria-pressed={active}
                  aria-label={`${c.name}${active ? " (selected)" : ""}`}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-green ${
                    active
                      ? "bg-oasis-green/10 border-oasis-green/30 text-oasis-green shadow-[0_0_15px_rgba(74,222,128,0.1)]"
                      : "bg-oasis-card border-oasis-border text-oasis-muted hover:text-oasis-text"
                  }`}
                >
                  <span className="text-base">{c.icon}</span>
                  {c.name}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Allergies */}
        <motion.div variants={fadeUp} className="mb-5">
          <h3 className="text-sm font-semibold text-oasis-text mb-2">Allergies</h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {allergies.map((a) => (
              <motion.span
                key={a}
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-400/10 border border-red-400/15 text-red-400 text-xs font-medium"
              >
                {a}
                <button
                  onClick={() => setAllergies((prev) => prev.filter((x) => x !== a))}
                  className="hover:bg-red-400/20 rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  aria-label={`Remove ${a} allergy`}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </motion.span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAllergy()}
              placeholder="Add allergy..."
              aria-label="Type an allergy to add"
              className="flex-1 px-3 py-2 rounded-xl bg-oasis-card border border-oasis-border text-xs text-oasis-text placeholder:text-oasis-muted focus:outline-none focus:border-oasis-green/40 focus:ring-1 focus:ring-oasis-green/20 transition-all"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={addAllergy}
              aria-label="Add allergy"
              className="w-9 h-9 rounded-xl bg-oasis-green/10 border border-oasis-green/20 flex items-center justify-center hover:bg-oasis-green/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-green"
            >
              <Plus size={16} className="text-oasis-green" />
            </motion.button>
          </div>
        </motion.div>

        {/* Language */}
        <motion.div variants={fadeUp} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={15} className="text-oasis-green" />
            <h3 className="text-sm font-semibold text-oasis-text">Language</h3>
          </div>
          <div className="flex gap-0 p-1 rounded-xl bg-oasis-card border border-oasis-border">
            {["English", "Hindi"].map((lang) => (
              <motion.button
                key={lang}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLanguage(lang)}
                className={`flex-1 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  language === lang
                    ? "bg-oasis-green text-oasis-black"
                    : "text-oasis-muted hover:text-oasis-text"
                }`}
              >
                {lang === "English" ? "🇬🇧 English" : "🇮🇳 हिंदी"}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Scan History as timeline */}
        <motion.div variants={fadeUp} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <History size={15} className="text-oasis-green" />
            <h2 className="font-[family-name:var(--font-instrument)] text-lg text-oasis-text">
              Scan History
            </h2>
          </div>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[27px] top-3 bottom-3 w-px bg-oasis-border" />
            <div className="space-y-2">
              {recentScans.map((p, i) => (
                <Link key={p.id} href={`/product/${p.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-oasis-card border border-oasis-border hover:bg-oasis-card-hover transition-colors relative"
                  >
                    <div className="w-3 h-3 rounded-full bg-oasis-green/20 border-2 border-oasis-green shrink-0 z-10" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-oasis-text truncate">{p.name}</p>
                      <p className="text-[11px] text-oasis-muted">{p.brand}</p>
                    </div>
                    <ScoreRing score={p.safety_score} grade={p.grade} size="sm" animate={false} />
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Upgrade to Pro — premium card */}
        <motion.div variants={fadeUp}>
          <div className="relative overflow-hidden p-5 rounded-2xl border border-oasis-green/20 shine-sweep">
            <div className="absolute inset-0 bg-gradient-to-br from-oasis-green/10 via-emerald-900/20 to-oasis-card" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
            <div className="relative">
              <div className="absolute top-0 right-0">
                <Crown size={20} className="text-oasis-green/40" />
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-oasis-green/20 text-oasis-green text-[10px] font-bold uppercase tracking-wider mb-2">
                Pro
              </span>
              <h3 className="text-base font-bold text-oasis-text mb-1">Upgrade to Oasis Pro</h3>
              <p className="text-xs text-oasis-muted leading-relaxed mb-3">
                Unlimited scans, photo analysis, personalized alerts, and family sharing.
              </p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-oasis-green">&#8377;99</span>
                <span className="text-xs text-oasis-muted">/month</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="w-full py-2.5 rounded-xl bg-oasis-green text-oasis-black text-sm font-bold shadow-[0_4px_20px_rgba(74,222,128,0.3)]"
              >
                Start Free Trial
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
