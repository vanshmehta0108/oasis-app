"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getAffiliateLinks } from "@/lib/affiliates";
import { track } from "@vercel/analytics";

interface BuyOnlineProps {
  productName: string;
  brand?: string;
  barcode?: string | null;
}

interface SwiggyPrice {
  price: number;
  mrp: number;
  unit: string;
  url: string;
}

export function BuyOnline({ productName, brand, barcode }: BuyOnlineProps) {
  const links = getAffiliateLinks(productName, brand);
  const [swiggyPrice, setSwiggyPrice] = useState<SwiggyPrice | null>(null);

  // Fetch live Swiggy Instamart price — only runs when API key is configured
  // on the server. Gracefully no-ops if not yet set up.
  useEffect(() => {
    const params = new URLSearchParams({ price: "1", name: productName });
    if (barcode) params.set("barcode", barcode);
    if (brand) params.set("brand", brand);

    fetch(`/api/swiggy?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.found && data.price) setSwiggyPrice(data.price as SwiggyPrice);
      })
      .catch(() => {/* no-op — static link still works */});
  }, [barcode, productName, brand]);

  function handleClick(platform: string) {
    track("affiliate_click", { platform, product: productName, brand: brand ?? "" });
  }

  // With 5 links the grid is 2-col: first 4 fill 2 rows, last one spans full width
  const mainLinks = links.slice(0, 4);
  const lastLink = links[4];

  return (
    <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-black/[0.04]">
        <ShoppingCart size={15} className="text-oasis-muted shrink-0" />
        <span className="text-[13px] font-semibold text-oasis-text">Buy Online</span>
      </div>

      <div className="grid grid-cols-2 gap-0">
        {mainLinks.map((link, i) => {
          const isRight = i % 2 === 1;
          const isSwiggy = link.platform === "swiggy";
          return (
            <Link
              key={link.platform}
              href={isSwiggy && swiggyPrice ? swiggyPrice.url : link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleClick(link.platform)}
              className="flex items-center gap-2.5 px-4 py-3 border-b border-black/[0.04] active:opacity-70 transition-opacity"
              style={{
                borderRight: !isRight ? "1px solid rgba(60,60,67,0.06)" : undefined,
                background: link.bg,
              }}
            >
              <span className="text-[18px] leading-none">{link.emoji}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold leading-tight" style={{ color: link.color }}>
                  {link.label}
                </span>
                {isSwiggy && swiggyPrice && (
                  <span className="text-[11px] font-medium text-oasis-muted leading-tight">
                    ₹{swiggyPrice.price}
                    {swiggyPrice.unit ? ` · ${swiggyPrice.unit}` : ""}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Last link spans full width */}
      {lastLink && (
        <Link
          href={lastLink.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleClick(lastLink.platform)}
          className="flex items-center gap-2.5 px-4 py-3 active:opacity-70 transition-opacity"
          style={{ background: lastLink.bg }}
        >
          <span className="text-[18px] leading-none">{lastLink.emoji}</span>
          <span className="text-[13px] font-semibold" style={{ color: lastLink.color }}>
            {lastLink.label}
          </span>
        </Link>
      )}
    </div>
  );
}
