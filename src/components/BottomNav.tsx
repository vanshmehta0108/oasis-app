"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Camera, Search, User } from "lucide-react";
import { motion } from "framer-motion";

const tabs = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/scan", icon: Camera, label: "Scan", featured: true },
  { href: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide on scan page for full-screen experience
  if (pathname === "/scan") return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-dark border-t border-white/[0.06]"
      aria-label="Main navigation"
    >
      <div
        className="flex items-end justify-around px-2 mx-auto max-w-lg safe-bottom"
        role="tablist"
      >
        {tabs.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          if (tab.featured) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative -mt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-green rounded-full"
                role="tab"
                aria-selected={active}
                aria-label={`${tab.label}${active ? " (current page)" : ""}`}
              >
                <motion.div
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  className="relative flex items-center justify-center w-[56px] h-[56px] rounded-full bg-oasis-green shadow-[0_4px_20px_rgba(74,222,128,0.4),0_0_40px_rgba(74,222,128,0.15)]"
                >
                  <Icon
                    size={24}
                    className="text-oasis-black"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                </motion.div>
                <span className="block text-center text-[10px] mt-1 text-oasis-green font-medium" aria-hidden="true">
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative pt-2 pb-1 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oasis-green rounded-lg"
              role="tab"
              aria-selected={active}
              aria-label={`${tab.label}${active ? " (current page)" : ""}`}
            >
              <motion.div
                className="flex flex-col items-center gap-0.5"
                whileTap={{ scale: 0.85 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <div className="relative">
                  <Icon
                    size={22}
                    className={active ? "text-oasis-green" : "text-oasis-muted"}
                    strokeWidth={active ? 2.5 : 1.8}
                    aria-hidden="true"
                  />
                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-oasis-green"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] ${
                    active ? "text-oasis-green font-medium" : "text-oasis-muted"
                  }`}
                  aria-hidden="true"
                >
                  {tab.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
