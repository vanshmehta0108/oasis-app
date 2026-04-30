"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Camera, Search, User } from "lucide-react";
import { useUserData } from "@/lib/userData";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

// Desktop-only navigation. Mirrors the mobile BottomNav but renders as a
// horizontal pill in the top-right corner so wider screens get an
// immediately-recognizable nav without the floating-tab-bar that overlaps
// content above the fold on desktop.
const tabs = [
  { href: "/",        icon: Home,   labelKey: "home"    as const },
  { href: "/search",  icon: Search, labelKey: "search"  as const },
  { href: "/scan",    icon: Camera, labelKey: "scan"    as const, featured: true },
  { href: "/profile", icon: User,   labelKey: "profile" as const },
];

export function TopNav() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const { data: userData, ready, error } = useUserData();

  if (!ready) return null;
  if (!userData.onboarded && !error) return null;
  // Hide on the fullscreen scan view so the camera fills the page.
  if (pathname.startsWith("/scan")) return null;

  return (
    <header className="hidden md:flex sticky top-0 z-40 w-full justify-center px-6 pt-3 pb-2 backdrop-blur-md bg-white/70 border-b border-black/5">
      <div className="w-full max-w-5xl flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[17px] tracking-tight text-sift-label">
          <span className="inline-flex w-7 h-7 rounded-lg bg-sift-blue items-center justify-center text-white text-[15px] font-bold">S</span>
          Sift
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1">
          {tabs.map((tab) => {
            const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            const label = t(tab.labelKey, language);
            const baseCls = "inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors";
            const stateCls = active
              ? "bg-sift-blue/10 text-sift-blue"
              : "text-sift-label/70 hover:text-sift-label hover:bg-black/5";
            const featuredCls = "bg-sift-blue text-white hover:bg-sift-blue/90";
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`${baseCls} ${tab.featured ? featuredCls : stateCls}`}
              >
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
