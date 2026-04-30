"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Heart, Globe, Crown, History, X, Plus, ScanLine, ShieldCheck, CheckCircle, LogOut, Bookmark } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ScoreRing } from "@/components/ScoreRing";
import { useToast } from "@/lib/useToast";
import { useUserData } from "@/lib/userData";
import { signInWithGoogle, signOut, displayNameFor, signInWithEmail, signUpWithEmail, resetPassword } from "@/lib/auth";
import { useUser } from "@/lib/useUser";

const healthConditions = [
  { name: "Diabetic",          key: "condition_diabetic" as const, icon: "💉" },
  { name: "Pregnant",          key: "condition_pregnant" as const, icon: "🤰" },
  { name: "Lactose Intolerant",key: "condition_lactose"  as const, icon: "🥛" },
  { name: "Gluten Sensitive",  key: "condition_gluten"   as const, icon: "🌾" },
  { name: "Heart Condition",   key: "condition_heart"    as const, icon: "❤️" },
  { name: "High BP",           key: "condition_bp"       as const, icon: "🩺" },
  { name: "Thyroid",           key: "condition_thyroid"  as const, icon: "🦋" },
  { name: "PCOD / PCOS",       key: "condition_pcod"     as const, icon: "🩷" },
  { name: "Kidney Disease",    key: "condition_kidney"   as const, icon: "🫘" },
];

function GoogleSVG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function AuthScreen() {
  const { language } = useLanguage();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const { showToast } = useToast();

  async function handleGoogle() {
    setLoading(true);
    const { ok, error } = await signInWithGoogle();
    if (!ok) { setLoading(false); showToast(error || "Sign-in failed", "error"); }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setMsg(null);
    const result = mode === "signup"
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password);
    setLoading(false);
    if (!result.ok) {
      setMsg({ text: result.error || "Something went wrong", ok: false });
    } else if (mode === "signup") {
      setMsg({ text: t('check_email_confirm', language), ok: true });
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const result = await resetPassword(email);
    setLoading(false);
    setMsg(result.ok
      ? { text: t('password_reset_sent', language), ok: true }
      : { text: result.error || "Reset failed", ok: false });
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: "#F2F2F7" }}>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: "#007AFF" }}>
        <ShieldCheck size={28} color="white" />
      </div>
      <h1 className="text-[22px] font-bold text-black mb-1">
        {mode === "reset" ? t('reset_password', language) : t('sign_in_to_sift', language)}
      </h1>
      <p className="text-sm text-center mb-8 max-w-xs" style={{ color: "#8E8E93" }}>
        {mode === "reset"
          ? "Enter your email and we'll send a reset link."
          : t('sign_in_desc', language)}
      </p>

      {mode !== "reset" && (
        <>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white border border-black/[0.12] font-semibold text-black mb-4 disabled:opacity-60"
            style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08)", maxWidth: 380 }}
          >
            <GoogleSVG /> {t('sign_in_google', language)}
          </motion.button>

          <div className="flex items-center w-full mb-4" style={{ maxWidth: 380 }}>
            <div className="flex-1 h-px bg-black/[0.08]" />
            <span className="px-3 text-xs" style={{ color: "#8E8E93" }}>or</span>
            <div className="flex-1 h-px bg-black/[0.08]" />
          </div>
        </>
      )}

      <form
        onSubmit={mode === "reset" ? handleReset : handleEmail}
        className="w-full space-y-3"
        style={{ maxWidth: 380 }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white border border-[#E5E5EA] text-sm text-black placeholder:text-[#8E8E93] focus:outline-none focus:border-[rgba(0,122,255,0.5)] transition-colors"
        />
        {mode !== "reset" && (
          <input
            type="password"
            placeholder={t('password_placeholder', language)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 rounded-xl bg-white border border-[#E5E5EA] text-sm text-black placeholder:text-[#8E8E93] focus:outline-none focus:border-[rgba(0,122,255,0.5)] transition-colors"
          />
        )}
        {msg && (
          <p className={`text-xs font-medium ${msg.ok ? "text-[#1E8040]" : "text-[#CC1010]"}`}>
            {msg.text}
          </p>
        )}
        <motion.button
          type="submit"
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl font-semibold text-white text-sm disabled:opacity-60"
          style={{ background: "#007AFF" }}
        >
          {loading ? "Please wait…" : mode === "signup" ? t('create_account', language) : mode === "reset" ? t('send_reset', language) : t('sign_in', language)}
        </motion.button>
      </form>

      <div className="mt-5 text-center space-y-3" style={{ maxWidth: 380 }}>
        {mode !== "reset" && (
          <button
            onClick={() => { setMsg(null); setMode(mode === "signin" ? "signup" : "signin"); }}
            className="text-sm font-medium block w-full"
            style={{ color: "#007AFF" }}
          >
            {mode === "signin" ? t('no_account', language) : t('already_account', language)}
          </button>
        )}
        {mode === "signin" && (
          <button
            onClick={() => { setMsg(null); setMode("reset"); }}
            className="text-xs block w-full"
            style={{ color: "#8E8E93" }}
          >
            Forgot password?
          </button>
        )}
        {mode === "reset" && (
          <button
            onClick={() => { setMsg(null); setMode("signin"); }}
            className="text-sm font-medium"
            style={{ color: "#007AFF" }}
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}

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
  const { language, setLanguage: setLanguageContext } = useLanguage();
  const [allergyInput, setAllergyInput] = useState("");
  const [allergyDropdown, setAllergyDropdown] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [showAllScans, setShowAllScans] = useState(false);
  const [showAllBookmarks, setShowAllBookmarks] = useState(false);
  const SCAN_PAGE = 8;
  const BOOKMARK_PAGE = 10;
  const { showToast } = useToast();

  const selectedConditions = userData.profile.conditions;
  const allergies = userData.profile.allergies;
  const profileLanguage = userData.profile.language;
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
    if (!confirm(t('signout_confirm', language))) return;
    await signOut();
    showToast(t('signed_out', language), "info");
  }

  async function handleDeleteMyData() {
    const typed = window.prompt(t('delete_my_data_confirm', language));
    if (typed === null) return; // cancelled
    if (typed.trim() !== "DELETE") {
      showToast(t('delete_my_data_typed_wrong', language), "error");
      return;
    }
    try {
      // Get the user's JWT to authorize the delete request.
      const { data: sess } = await import("@/lib/supabase").then((m) => m.supabase.auth.getSession());
      const token = sess?.session?.access_token;
      if (!token) {
        showToast(t('delete_my_data_failed', language), "error");
        return;
      }
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        showToast(t('delete_my_data_failed', language), "error");
        return;
      }
      // Wipe local state too.
      try { localStorage.removeItem("sift-ext"); localStorage.removeItem("sift-onboarded"); } catch {}
      await signOut();
      showToast(t('delete_my_data_success', language), "info");
    } catch {
      showToast(t('delete_my_data_failed', language), "error");
    }
  }

  const toggleCondition = (c: string) => {
    const next = selectedConditions.includes(c)
      ? selectedConditions.filter((x) => x !== c)
      : [...selectedConditions, c];
    setProfile({ conditions: next }).catch(() => showToast("Couldn't save — please try again", "error"));
  };

  const COMMON_ALLERGENS = ["Peanuts", "Milk", "Gluten", "Soy", "Eggs", "Tree Nuts", "Shellfish", "Fish", "Wheat", "Sulfites", "Sesame", "Mustard"];

  const addAllergy = (value?: string) => {
    const trimmed = (value ?? allergyInput).trim();
    if (!trimmed || allergies.includes(trimmed)) return;
    setAllergyInput("");
    setProfile({ allergies: [...allergies, trimmed] }).catch(() => showToast("Couldn't save — please try again", "error"));
  };

  const addFromDropdown = (value: string) => {
    setAllergyDropdown("");
    if (value && !allergies.includes(value)) {
      setProfile({ allergies: [...allergies, value] }).catch(() => showToast("Couldn't save — please try again", "error"));
    }
  };

  const removeAllergy = (a: string) => {
    setProfile({ allergies: allergies.filter((x) => x !== a) }).catch(() => showToast("Couldn't save — please try again", "error"));
  };

  const setLanguage = (lang: "English" | "Hindi") => {
    setProfile({ language: lang }).catch(() => showToast("Couldn't save — please try again", "error"));
    setLanguageContext(lang === "English" ? "en" : "hi");
  };

  const visibleScans = scanHistory.slice(0, showAllScans ? undefined : SCAN_PAGE);
  const visibleBookmarks = userData.bookmarks.slice(0, showAllBookmarks ? undefined : BOOKMARK_PAGE);
  const safeProducts = scanHistory.filter((p) => (p.score ?? 0) >= 70).length;

  if (ready && error === "setup_required") {
    return <AuthScreen />;
  }
  if (ready && error === "migration_required") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center" style={{ background: "#F2F2F7" }}>
        <div className="w-16 h-16 rounded-full bg-[#FF9F0A]/10 flex items-center justify-center mb-4">
          <User size={28} className="text-[#B87800]" />
        </div>
        <h1 className="text-[18px] font-bold text-black mb-2">{t('migration_required', language)}</h1>
        <p className="text-sm max-w-sm" style={{ color: "#8E8E93" }}>
          {t('migration_desc', language)}
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
        className="px-4 pb-24 max-w-lg md:max-w-2xl mx-auto"
        style={{ paddingTop: "max(3rem, env(safe-area-inset-top))" }}
        initial="hidden"
        animate="show"
        variants={stagger}
      >
        {/* Avatar area */}
        <motion.div variants={fadeUp} className="flex flex-col items-center pt-2 pb-6 mb-2">
          <div className="w-20 h-20 rounded-full bg-white border border-black/[0.08] flex items-center justify-center mb-3 overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            {user?.user_metadata?.avatar_url ? (
              <Image src={user.user_metadata.avatar_url as string} alt="Profile picture" width={80} height={80} className="w-full h-full object-cover" />
            ) : (
              <User size={32} style={{ color: "#007AFF" }} />
            )}
          </div>
          <h1 className="font-bold tracking-tight text-[22px] text-black">
            {user && !isAnonymous ? displayNameFor(user) : "Your Profile"}
          </h1>
          <span className="text-xs mt-1" style={{ color: "#8E8E93" }}>
            {isAnonymous ? t('personalise_alerts', language) : user?.email || "Signed in"}
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
              {signingIn ? t('opening_google', language) : t('sign_in_google', language)}
            </motion.button>
          )}
          {!authAvailable && (
            <span className="mt-3 text-[10px] max-w-xs text-center" style={{ color: "#8E8E93" }}>
              {t('cloud_sync_disabled', language)}
            </span>
          )}
          {user && !isAnonymous && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: "#8E8E93" }}
              >
                <LogOut size={12} aria-hidden="true" />
                {t('sign_out', language)}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleDeleteMyData}
                className="text-[11px] font-medium underline"
                style={{ color: "#CC1010" }}
              >
                {t('delete_my_data', language)}
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Stats row */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <ScanLine size={16} style={{ color: "#007AFF" }} />, value: scanCount, label: t('total_scans', language), color: "#007AFF" },
              { icon: <ShieldCheck size={16} style={{ color: "#007AFF" }} />, value: scanHistory.length, label: t('checked', language), color: "#007AFF" },
              { icon: <CheckCircle size={16} style={{ color: "#34C759" }} />, value: safeProducts, label: t('safe_picks', language), color: "#34C759" },
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
            <h2 className="font-semibold text-[17px] text-black">{t('health_conditions', language)}</h2>
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
                  aria-label={`${t(c.key, language)}${active ? " (selected)" : ""}`}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sift-blue"
                  style={active
                    ? { background: "rgba(0,122,255,0.08)", borderColor: "rgba(0,122,255,0.25)", color: "#007AFF" }
                    : { background: "#FFFFFF", borderColor: "#E5E5EA", color: "#8E8E93" }
                  }
                >
                  <span className="text-base">{c.icon}</span>
                  {t(c.key, language)}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Allergies */}
        <motion.div variants={fadeUp} className="mb-5">
          <h3 className="text-sm font-semibold text-black mb-2">{t('allergies', language)}</h3>

          {/* Current allergy chips */}
          {allergies.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
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
          )}

          {/* Common allergens dropdown */}
          <select
            value={allergyDropdown}
            onChange={(e) => addFromDropdown(e.target.value)}
            aria-label="Select a common allergen"
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EA] text-sm text-black focus:outline-none focus:border-[rgba(0,122,255,0.4)] mb-2 appearance-none"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
          >
            <option value="">Select common allergen…</option>
            {COMMON_ALLERGENS.filter((a) => !allergies.includes(a)).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Custom allergy input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAllergy()}
              placeholder="Or type a custom allergy…"
              aria-label="Type a custom allergy to add"
              className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#E5E5EA] text-xs text-black placeholder:text-[#8E8E93] focus:outline-none focus:border-[rgba(0,122,255,0.4)] focus:ring-1 focus:ring-[rgba(0,122,255,0.2)] transition-all"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => addAllergy()}
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
            <h3 className="text-sm font-semibold text-black">{t('language_setting', language)}</h3>
          </div>
          <div className="flex gap-0 p-1 rounded-xl bg-white border border-[#E5E5EA]">
            {(["English", "Hindi"] as const).map((lang) => (
              <motion.button
                key={lang}
                whileTap={{ scale: 0.95 }}
                onClick={() => setLanguage(lang)}
                aria-pressed={profileLanguage === lang}
                className="flex-1 px-4 py-2 rounded-lg text-xs font-medium transition-all"
                style={profileLanguage === lang
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
              <h2 className="font-semibold text-[17px] text-black">{t('saved_products', language)}</h2>
              <span className="text-[11px]" style={{ color: "#8E8E93" }}>· {userData.bookmarks.length}</span>
            </div>
            <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              {visibleBookmarks.map((b, i) => (
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
            {userData.bookmarks.length > BOOKMARK_PAGE && (
              <button
                onClick={() => setShowAllBookmarks((v) => !v)}
                className="w-full mt-2 py-2.5 text-sm font-semibold rounded-xl bg-white"
                style={{ color: "#007AFF", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}
              >
                {showAllBookmarks ? "Show less" : `Show all ${userData.bookmarks.length} saved`}
              </button>
            )}
          </motion.div>
        )}

        {/* Scan History as timeline */}
        <motion.div variants={fadeUp} className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <History size={15} style={{ color: "#007AFF" }} />
            <h2 className="font-semibold text-[17px] text-black">{t('scan_history', language)}</h2>
            {scanHistory.length > 0 && (
              <span className="text-[11px]" style={{ color: "#8E8E93" }}>· {scanHistory.length}</span>
            )}
          </div>
          {scanHistory.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              <ScanLine size={24} className="mx-auto mb-2" style={{ color: "#C7C7CC" }} />
              <p className="text-sm" style={{ color: "#8E8E93" }}>No scans yet — scan a product to see your history.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                <div className="space-y-0">
                  {visibleScans.map((p, i) => (
                    <Link key={`${p.id}-${p.timestamp}`} href={`/product/${p.id}`}>
                      <motion.div
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
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
              {scanHistory.length > SCAN_PAGE && (
                <button
                  onClick={() => setShowAllScans((v) => !v)}
                  className="w-full mt-2 py-2.5 text-sm font-semibold rounded-xl bg-white"
                  style={{ color: "#007AFF", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}
                >
                  {showAllScans ? "Show less" : `Show all ${scanHistory.length} scans`}
                </button>
              )}
            </>
          )}
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
              <h3 className="text-base font-bold text-white mb-1">{t('upgrade_pro', language)}</h3>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.75)" }}>
                {t('upgrade_desc', language)}
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

        {/* Footer — privacy + about */}
        <motion.div variants={fadeUp} className="mt-6 mb-2 flex justify-center gap-4">
          <Link
            href="/privacy"
            className="text-[11px] font-medium"
            style={{ color: "#8E8E93" }}
          >
            {t('privacy_link', language)}
          </Link>
          <span className="text-[11px]" style={{ color: "#C7C7CC" }}>·</span>
          <a
            href="mailto:privacy@sift-india.app"
            className="text-[11px] font-medium"
            style={{ color: "#8E8E93" }}
          >
            privacy@sift-india.app
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
