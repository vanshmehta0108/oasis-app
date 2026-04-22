"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Camera, Search, User } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const tabs = [
  { href: "/",        icon: Home,   label: "Home"    },
  { href: "/search",  icon: Search, label: "Search"  },
  { href: "/scan",    icon: Camera, label: "Scan",   featured: true },
  { href: "/profile", icon: User,   label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem("oasis-onboarded");
    setVisible(!!onboarded && pathname !== "/scan");
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <nav
        className="flex items-center gap-1 px-2 py-2 rounded-[28px]"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
          border: "0.5px solid rgba(0,0,0,0.08)",
        }}
        aria-label="Main navigation"
        role="tablist"
      >
        {tabs.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          if (tab.featured) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sift-blue rounded-full mx-1"
                role="tab"
                aria-selected={active}
                aria-label="Scan a product"
              >
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="flex items-center justify-center w-[52px] h-[52px] rounded-full"
                  style={{
                    background: "#007AFF",
                    boxShadow: "0 4px 16px rgba(0,122,255,0.36)",
                  }}
                >
                  <Icon size={22} color="#FFFFFF" strokeWidth={2} aria-hidden="true" />
                </motion.div>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sift-blue rounded-xl"
              role="tab"
              aria-selected={active}
              aria-label={`${tab.label}${active ? " (current page)" : ""}`}
            >
              <motion.div
                className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-2xl relative"
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                style={active ? { background: "rgba(0,122,255,0.08)" } : {}}
              >
                <Icon
                  size={21}
                  aria-hidden="true"
                  strokeWidth={active ? 2.5 : 1.8}
                  color={active ? "#007AFF" : "#8E8E93"}
                />
                <span
                  className="text-[10px] font-medium leading-none"
                  style={{ color: active ? "#007AFF" : "#8E8E93" }}
                  aria-hidden="true"
                >
                  {tab.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
