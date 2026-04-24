"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Heart, Globe, Crown, History, X, Plus, ScanLine, ShieldCheck, CheckCircle, LogOut, Bookmark } from "lucide-react";
import Link from "next/link";
import { ScoreRing } from "@/components/ScoreRing";
import { useToast } from "@/lib/useToast";
import { useUserData } from "@/lib/userData";
import { signInWithGoogle, signOut, displayNameFor } from "@/lib/auth";
import { useUser } from "@/lib/useUser";

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
  const { user, isAnonymous, authAvailable } = useUser();
  const { data: userData, ready, error, setProfile } = useUserData();
  const [allergyInput, setAllergyInput] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const { showToast } = useToast();

  const selectedConditions = userData.profile.conditions;
  const allergies = userData.profile.allergies;
  const language = userData.profile.language;
  const scanHistory = userData.scanHistory;
  const scanCount = userData.scanCount;

  async function handleSignIn() {
    setSigningIn(true);
    const { ok, error } = await signInWithGoogle();
    if (!ok) {
      setSigningIn(false);
      showToast(error || "Sign-in failed — please try again", "error");
    }
  }

  async function handleSignOut() {
    if (!confirm("Sign out? You'll lose access to your cross-device history on this browser until you sign back in.")) return;
    await signOut();
    showToast("Signed out", "info");
  }

  const toggleCondition = (c: string) => {
    const next = selectedConditions.includes(c)
      ? selectedConditions.filter((x) => x !== c)
      : [...selectedConditions, c];
    void setProfile({ conditions: next });
  };

  const addAllergy = () => {
    const trimmed = allergyInput.trim();
    if (!trimmed || allergies.includes(trimmed)) return;
    setAllergyInput("");
    void setProfile({ allergies: [...allergies, trimmed] });
  };

  const removeAllergy = (a: string) => {
    void setProfile({ allergies: allergies.filter((x) => x !== a) });
  };

  const setLanguage = (lang: "English" | "Hindi") => {
    void setProfile({ language: lang });
  };

  const recentScans = scanHistory.slice(0, 5);
  const safeProducts = scanHistory.filter((p) => (p.score ?? 0) >= 70).length;

  // Cloud mode required — show a clear setup-required state instead of a
  // broken-looking page when anonymous auth isn't enabled yet.
  if (ready && error === "setup_required") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center" style={{ background: "#F2F2F7" }}>
        <div className="w-16 h-16 rounded-full bg-[#007AFF]/10 flex items-center justify-center mb-4">
          <User size={28} className="text-[#007AFF]" />
        </div>
        <h1 className="text-[18px] font-bold text-black mb-2">Cloud setup required</h1>
        <p className="text-sm max-w-sm" style={{ color: "#8E8E93" }}>
          Anonymous sign-ins aren&apos;t enabled on this deployment yet. See <code>docs/auth-setup.md</code> — it takes 15 minutes.
        </p>
      </div>
    );
  }
  if (ready && error === "migration_required") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center" style={{ background: "#F2F2F7" }}>
        <div className="w-16 h-16 rounded-full bg-[#FF9F0A]/10 flex items-center justify-center mb-4">
          <User size={28} className="text-[#B87800]" />
        </div>
        <h1 className="text-[18px] font-bold text-black mb-2">Database migration required</h1>
        <p className="text-sm max-w-sm" style={{ color: "#8E8E93" }}>
          Run <code>docs/cloud-migration.sql</code> in the Supabase SQL editor to enable cloud profile + scan history.
        </p>
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "#F2F2F7" }}>
        <div className="w-10 h-10 rounded-full border-2 border-[#007AFF]/20 border-t-[#007AFF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh" style={{ background: "#F2F2F7" }}>
      <motion.div
        className="px-4 pt-12 pb-24 max-w-lg mx-auto"
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {/* Avatar area */}
        <motion.div variants={fadeUp} className="flex flex-col items-center pt-2 pb-6 mb-2">
          <div className="w-20 h-20 rounded-full bg-white border border-black/[0.08] flex items-center justify-center mb-3 overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            {user?.user_metadata?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.user_metadata.avatar_url as string} alt="Profile picture" className="w-full h-full object-cover" />
            ) : (
              <User size={32} style={{ color: "#007AFF" }} />
            )}
          </div>
          <h1 className="font-bold tracking-tight text-[22px] text-black">
            {user && !isAnonymous ? displayNameFor(user) : "Your Profile"}
          </h1>
          <span className="text-xs mt-1" style={{ color: "#8E8E93" }}>
            {isAnonymous ? "Personalize your safety alerts" : user?.email || "Signed in"}
          </span>

          {/* Account actions */}
          {authAvailable && isAnonymous && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleSignIn}
              disabled={signingIn}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-black/[0.12] text-sm font-semibold text-black disabled:opacity-60"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            >
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              {signingIn ? "Opening Google…" : "Sign in with Google"}
            </motion.button>
          )}
          {!authAvailable && (
            <span className="mt-3 text-[10px] max-w-xs text-center" style={{ color: "#8E8E93" }}>
              Cloud sync not yet enabled for this deployment — your data stays on this device.
            </span>
          )}
          {user && !isAnonymous && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleSignOut}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium"
              style={{ color: "#8E8E93" }}
            >
              <LogOut size={12} aria-hidden="true" />
              Sign out
            </motion.button>
          )}
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
                  onClick={() => removeAllergy(a)}
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
            {(["English", "Hindi"] as const).map((lang) => (
              <motion.button
                key={lang}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
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

        {/* Saved products */}
        {userData.bookmarks.length > 0 && (
          <motion.div variants={fadeUp} className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Bookmark size={15} style={{ color: "#007AFF" }} />
              <h2 className="font-semibold text-[17px] text-black">Saved Products</h2>
              <span className="text-[11px]" style={{ color: "#8E8E93" }}>· {userData.bookmarks.length}</span>
            </div>
            <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              {userData.bookmarks.slice(0, 10).map((b, i) => (
                <Link key={b.id} href={`/product/${b.id}`}>
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-black/[0.06]" : ""}`}
                  >
                    <Bookmark size={14} className="text-[#007AFF] shrink-0" fill="#007AFF" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-black truncate">{b.name}</p>
                      <p className="text-[11px]" style={{ color: "#8E8E93" }}>{b.brand}</p>
                    </div>
                    <ScoreRing score={b.safety_score} grade={b.grade} size="sm" animate={false} />
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

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
                onClick={() => showToast("Sift Pro is launching soon — we'll notify you!", "info")}
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
