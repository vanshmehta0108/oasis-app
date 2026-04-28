// Affiliate link generators for Indian quick-commerce platforms.
// Set NEXT_PUBLIC_AFFILIATE_AMAZON_TAG in .env.local once you have
// your Amazon Associates India tag (affiliate-program.amazon.in).

const AMAZON_TAG = process.env.NEXT_PUBLIC_AFFILIATE_AMAZON_TAG ?? "";

export interface AffiliateLink {
  platform: "blinkit" | "zepto" | "amazon" | "bigbasket";
  label: string;
  url: string;
  color: string;
  bg: string;
  emoji: string;
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

  return [
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
