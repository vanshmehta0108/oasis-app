"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Heart, Globe, Crown, History, X, Plus, ScanLine, ShieldCheck, CheckCircle } from "lucide-react";
import Link from "next/link";
import { ScoreRing } from "@/components/ScoreRing";
// Products now come from Supabase — no mock imports
import { getScanHistory, getScanCount, type ScanRecord } from "@/lib/scanHistory";

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

function loadProfile() {
  if (typeof window === "undefined") return { conditions: [], allergies: [], language: "English" };
  try {
    const saved = localStorage.getItem("oasis-profile");
    if (saved) return JSON.parse(saved);
  } catch {}
  return { conditions: [], allergies: [], language: "English" };
}

export default function ProfilePage() {
  const [selectedConditions, setSelectedConditions] = useState<string[]>(() => loadProfile().conditions ?? []);
  const [allergies, setAllergies] = useState<string[]>(() => loadProfile().allergies ?? []);
  const [allergyInput, setAllergyInput] = useState("");
  const [language, setLanguage] = useState<string>(() => loadProfile().language ?? "English");
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([]);
  const [scanCount, setScanCount] = useState(0);

  useEffect(() => {
    setScanHistory(getScanHistory());
    setScanCount(getScanCount());
  }, []);

  // Save profile to localStorage whenever conditions, allergies, or language change
  useEffect(() => {
    localStorage.setItem("oasis-profile", JSON.stringify({
      conditions: selectedConditions,
      allergies,
      language,
    }));
  }, [selectedConditions, allergies, language]);

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

  const recentScans = scanHistory.slice(0, 5);
  const safeProducts = scanHistory.filter((p) => (p.score ?? 0) >= 70).length;

  return (
    <div className="min-h-dvh" style={{ background: "#F2F2F7" }}>
      <motion.div
        className="px-4 pt-12 pb-24 max-w-lg mx-auto"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {/* Avatar area with gradient bg */}
        <motion.div variants={fadeUp} className="flex flex-col items-center pt-2 pb-6 mb-2">
          <div className="w-20 h-20 rounded-full bg-white border border-black/[0.08] flex items-center justify-center mb-3" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <User size={32} style={{ color: "#007AFF" }} />
          </div>
          <h1 className="font-bold tracking-tight text-[22px] text-black">Your Profile</h1>
          <span className="text-xs mt-1" style={{ color: "#8E8E93" }}>Personalize your safety alerts</span>
        </motion.div>

        {/* Stats row */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <ScanLine size={16} style={{ color: "#007AFF" }} />, value: scanCount, label: "Total Scans", color: "#007AFF" },
              { icon: <ShieldCheck size={16} style={{ color: "#007AFF" }} />, value: scanHistory.length, label: "Checked", color: "#007AFF" },
              { icon: <CheckCircle size={16} style={{ color: "#34C759" }} />, value: safeProducts, label: "Safe Picks", color: "#34C759" },
            ].map(({ icon, value, label, color }) => (
              <div key={label} className="flex flex-col items-center p-3 rounded-2xl bg-white" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                {icon}
                <span className="text-lg font-bold mt-1" style={{ color }}>{value}</span>
                <span className="text-[10px] mt-0.5" style={{ color: "#8E8E93" }}>{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Health Profile */}
        <motion.div variants={fadeUp} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={15} style={{ color: "#007AFF" }} />
            <h2 className="font-semibold text-[17px] text-black">Health Conditions</h2>
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
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sift-blue"
                  style={active
                    ? { background: "rgba(0,122,255,0.08)", borderColor: "rgba(0,122,255,0.25)", color: "#007AFF" }
                    : { background: "#FFFFFF", borderColor: "#E5E5EA", color: "#8E8E93" }
                  }
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
          <h3 className="text-sm font-semibold text-black mb-2">Allergies</h3>
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
              className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#E5E5EA] text-xs text-black placeholder:text-[#8E8E93] focus:outline-none focus:border-[rgba(0,122,255,0.4)] focus:ring-1 focus:ring-[rgba(0,122,255,0.2)] transition-all"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={addAllergy}
              aria-label="Add allergy"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sift-blue"
              style={{ background: "rgba(0,122,255,0.08)", border: "1px solid rgba(0,122,255,0.2)" }}
            >
              <Plus size={16} style={{ color: "#007AFF" }} />
            </motion.button>
          </div>
        </motion.div>

        {/* Language */}
        <motion.div variants={fadeUp} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={15} style={{ color: "#007AFF" }} />
            <h3 className="text-sm font-semibold text-black">Language</h3>
          </div>
          <div className="flex gap-0 p-1 rounded-xl bg-white border border-[#E5E5EA]">
            {["English", "Hindi"].map((lang) => (
              <motion.button
                key={lang}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLanguage(lang)}
                className="flex-1 px-4 py-2 rounded-lg text-xs font-medium transition-all"
                style={language === lang
                  ? { background: "#007AFF", color: "#FFFFFF" }
                  : { color: "#8E8E93" }
                }
              >
                {lang === "English" ? "🇬🇧 English" : "🇮🇳 हिंदी"}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Scan History as timeline */}
        <motion.div variants={fadeUp} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <History size={15} style={{ color: "#007AFF" }} />
            <h2 className="font-semibold text-[17px] text-black">Scan History</h2>
          </div>
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
            <div className="space-y-0">
              {recentScans.map((p, i) => (
                <Link key={p.id} href={`/product/${p.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-black/[0.06]" : ""}`}
                  >
                    <div className="w-3 h-3 rounded-full bg-[rgba(0,122,255,0.2)] border-2 border-[#007AFF] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-black truncate">{p.name}</p>
                      <p className="text-[11px]" style={{ color: "#8E8E93" }}>{p.brand}</p>
                    </div>
                    <ScoreRing score={p.score ?? 0} grade={p.grade ?? "?"} size="sm" animate={false} />
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Upgrade to Pro — premium card */}
        <motion.div variants={fadeUp}>
          <div className="relative overflow-hidden p-5 rounded-2xl shine-sweep" style={{ background: "#007AFF" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#0A84FF] to-[#0056CC]" />
            <div className="relative">
              <div className="absolute top-0 right-0">
                <Crown size={20} style={{ color: "rgba(255,255,255,0.5)" }} />
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2" style={{ background: "rgba(255,255,255,0.2)", color: "#FFFFFF" }}>
                Pro
              </span>
              <h3 className="text-base font-bold text-white mb-1">Upgrade to Sift Pro</h3>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.75)" }}>
                Unlimited scans, photo analysis, personalized alerts, and family sharing.
              </p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-bold text-white">&#8377;99</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>/month</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="w-full py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "#FFFFFF", color: "#007AFF" }}
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
