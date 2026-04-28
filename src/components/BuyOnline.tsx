"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getAffiliateLinks } from "@/lib/affiliates";
import { track } from "@vercel/analytics";

interface BuyOnlineProps {
  productName: string;
  brand?: string;
}

export function BuyOnline({ productName, brand }: BuyOnlineProps) {
  const links = getAffiliateLinks(productName, brand);

  function handleClick(platform: string) {
    track("affiliate_click", { platform, product: productName, brand: brand ?? "" });
  }

  return (
    <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-black/[0.04]">
        <ShoppingCart size={15} className="text-oasis-muted shrink-0" />
        <span className="text-[13px] font-semibold text-oasis-text">Buy Online</span>
      </div>
      <div className="grid grid-cols-2 gap-0">
        {links.map((link, i) => {
          const isRight = i % 2 === 1;
          const isLastRow = i >= links.length - 2;
          return (
            <Link
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleClick(link.platform)}
              className="flex items-center gap-2.5 px-4 py-3 active:opacity-70 transition-opacity"
              style={{
                borderRight: !isRight ? "1px solid rgba(60,60,67,0.06)" : undefined,
                borderBottom: !isLastRow ? "1px solid rgba(60,60,67,0.06)" : undefined,
                background: link.bg,
              }}
            >
              <span className="text-[18px] leading-none">{link.emoji}</span>
              <span className="text-[13px] font-semibold" style={{ color: link.color }}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
