// Affiliate link generators for Indian quick-commerce platforms.
// Set NEXT_PUBLIC_AFFILIATE_AMAZON_TAG in .env.local once you have
// your Amazon Associates India tag (affiliate-program.amazon.in).
//
// Swiggy Instamart:
//   Static deep-link search works immediately (no key needed).
//   Live price display requires SWIGGY_API_KEY (server-side only) from
//   Swiggy Builders Club approval → https://mcp.swiggy.com/builders/

const AMAZON_TAG = process.env.NEXT_PUBLIC_AFFILIATE_AMAZON_TAG ?? "";

export interface AffiliateLink {
  platform: "blinkit" | "zepto" | "amazon" | "bigbasket" | "swiggy";
  label: string;
  url: string;
  color: string;
  bg: string;
  emoji: string;
  badge?: string; // e.g. "₹89" — live price injected by BuyOnline after API call
}

function encodeQuery(query: string): string {
  // Trim to first 60 chars so URLs stay clean
  return encodeURIComponent(query.trim().slice(0, 60));
}

// Build a focused search query: prefer "brand + name" but fall back to name only
function buildQuery(name: string, brand?: string): string {
  if (brand && brand.toLowerCase() !== "unknown" && brand.trim().length > 0) {
    return `${brand.trim()} ${name.trim()}`;
  }
  return name.trim();
}

export function getAffiliateLinks(
  productName: string,
  brand?: string,
): AffiliateLink[] {
  const query = buildQuery(productName, brand);
  const q = encodeQuery(query);

  const amazonBase = `https://www.amazon.in/s?k=${q}`;
  const amazonUrl = AMAZON_TAG ? `${amazonBase}&tag=${AMAZON_TAG}` : amazonBase;

  // Swiggy Instamart deep-link search (works without API key)
  const swiggyUrl = `https://www.swiggy.com/instamart/search?query=${q}`;

  return [
    {
      platform: "swiggy",
      label: "Instamart",
      url: swiggyUrl,
      color: "#d04e01",
      bg: "rgba(252,88,0,0.08)",
      emoji: "🧡",
    },
    {
      platform: "blinkit",
      label: "Blinkit",
      url: `https://blinkit.com/s/?q=${q}`,
      color: "#856404",
      bg: "rgba(248,220,0,0.12)",
      emoji: "🟡",
    },
    {
      platform: "zepto",
      label: "Zepto",
      url: `https://www.zeptonow.com/search?query=${q}`,
      color: "#7B2FBE",
      bg: "rgba(151,71,255,0.10)",
      emoji: "⚡",
    },
    {
      platform: "amazon",
      label: "Amazon Fresh",
      url: amazonUrl,
      color: "#B45309",
      bg: "rgba(255,153,0,0.10)",
      emoji: "📦",
    },
    {
      platform: "bigbasket",
      label: "BigBasket",
      url: `https://www.bigbasket.com/ps/?q=${q}`,
      color: "#166534",
      bg: "rgba(34,197,94,0.10)",
      emoji: "🛒",
    },
  ];
}
