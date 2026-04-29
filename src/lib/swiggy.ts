// Swiggy Builders Club API client
// Docs arrive post-approval — update BASE_URL and endpoint paths below.
// Apply for access: https://mcp.swiggy.com/builders/ → builders@swiggy.in
//
// Required env vars (add to .env.local + Vercel dashboard after approval):
//   SWIGGY_API_KEY=<your key>
//   SWIGGY_CLIENT_ID=<your client id>   (if Swiggy issues one)

// ── Config ─────────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.swiggy.com"; // update once docs arrive
const API_VERSION = "v1";

function apiKey(): string {
  return process.env.SWIGGY_API_KEY ?? "";
}

function isConfigured(): boolean {
  return apiKey().length > 0;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SwiggyProduct {
  id: string;
  name: string;
  brand: string;
  barcode: string | null;
  category: string;
  imageUrl: string | null;
  price: number | null;         // INR, e.g. 89
  mrp: number | null;           // INR
  unit: string | null;          // "500g", "1L"
  ingredients: string[];
  nutritionalInfo: Record<string, string> | null;
  instamartUrl: string | null;  // deep link into Instamart
  inStock: boolean;
}

export interface SwiggySearchResult {
  products: SwiggyProduct[];
  total: number;
  source: "swiggy_api" | "static_link";
}

// ── Normalizer ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(raw: Record<string, any>): SwiggyProduct {
  // Field names will become clear once the API docs arrive.
  // These are educated guesses based on common Swiggy response structures.
  return {
    id: String(raw.id ?? raw.product_id ?? ""),
    name: String(raw.name ?? raw.product_name ?? ""),
    brand: String(raw.brand ?? raw.brand_name ?? ""),
    barcode: raw.barcode ?? raw.ean ?? raw.gtin ?? null,
    category: String(raw.category ?? raw.category_name ?? ""),
    imageUrl: raw.image_url ?? raw.image ?? raw.thumbnail ?? null,
    price: raw.price ?? raw.selling_price ?? raw.offer_price ?? null,
    mrp: raw.mrp ?? raw.market_price ?? null,
    unit: raw.unit ?? raw.quantity ?? raw.pack_size ?? null,
    ingredients: Array.isArray(raw.ingredients)
      ? raw.ingredients
      : typeof raw.ingredients === "string"
        ? raw.ingredients.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
        : [],
    nutritionalInfo: raw.nutritional_info ?? raw.nutrition ?? null,
    instamartUrl: raw.deep_link ?? raw.instamart_url ?? null,
    inStock: raw.in_stock ?? raw.available ?? true,
  };
}

// ── HTTP helpers ───────────────────────────────────────────────────────────────

async function get(
  path: string,
  params: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const url = new URL(`${BASE_URL}/${API_VERSION}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      "X-Client-ID": process.env.SWIGGY_CLIENT_ID ?? "sift",
    },
    next: { revalidate: 300 }, // cache 5 min on Vercel edge
  });

  if (!res.ok) {
    throw new Error(`Swiggy API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Search Instamart product catalog by name + optional brand.
// Returns up to `limit` results sorted by relevance.
export async function searchInstamart(
  query: string,
  limit = 5,
): Promise<SwiggySearchResult> {
  if (!isConfigured()) {
    return { products: [], total: 0, source: "static_link" };
  }

  try {
    // Endpoint path to confirm from docs — common pattern for Instamart search
    const data = await get("/instamart/products/search", {
      q: query,
      limit: String(limit),
    });

    const raw = (data.products ?? data.items ?? data.results ?? []) as Record<string, unknown>[];
    const products = (raw as Record<string, unknown>[]).map((p) =>
      normalize(p as Record<string, never>)
    );

    return { products, total: (data.total as number) ?? products.length, source: "swiggy_api" };
  } catch (err) {
    console.error("Swiggy search failed:", err instanceof Error ? err.message : err);
    return { products: [], total: 0, source: "static_link" };
  }
}

// Look up a specific product by barcode (EAN-13 / UPC).
export async function getProductByBarcode(
  barcode: string,
): Promise<SwiggyProduct | null> {
  if (!isConfigured()) return null;

  try {
    const data = await get(`/instamart/products/barcode/${barcode}`);
    const raw = (data.product ?? data.data ?? data) as Record<string, unknown>;
    if (!raw?.id && !raw?.product_id) return null;
    return normalize(raw as Record<string, never>);
  } catch {
    return null;
  }
}

// Get the live Instamart price for a product by barcode or name.
// Returns null if not configured or product not found.
export async function getInstamartPrice(
  barcode: string | null,
  name: string,
  brand?: string,
): Promise<{ price: number; mrp: number; unit: string; url: string } | null> {
  if (!isConfigured()) return null;

  try {
    let product: SwiggyProduct | null = null;

    if (barcode) {
      product = await getProductByBarcode(barcode);
    }

    if (!product) {
      const q = brand ? `${brand} ${name}` : name;
      const results = await searchInstamart(q, 1);
      product = results.products[0] ?? null;
    }

    if (!product?.price) return null;

    return {
      price: product.price,
      mrp: product.mrp ?? product.price,
      unit: product.unit ?? "",
      url: product.instamartUrl ?? buildStaticSearchUrl(name, brand),
    };
  } catch {
    return null;
  }
}

// Static Instamart search URL — works without API credentials.
// Used as the affiliate link before API approval and as fallback.
export function buildStaticSearchUrl(name: string, brand?: string): string {
  const q = encodeURIComponent(
    brand && brand.toLowerCase() !== "unknown"
      ? `${brand} ${name}`.trim().slice(0, 60)
      : name.trim().slice(0, 60),
  );
  return `https://www.swiggy.com/instamart/search?query=${q}`;
}

// Enrich a product record with Swiggy ingredient/nutrition data.
// Used by the bulk enrichment script and the API route.
export async function enrichFromSwiggy(
  barcode: string | null,
  name: string,
  brand?: string,
): Promise<{
  ingredients: string[];
  nutritionalInfo: Record<string, string> | null;
  imageUrl: string | null;
  price: number | null;
} | null> {
  if (!isConfigured()) return null;

  try {
    let product: SwiggyProduct | null = null;

    if (barcode) product = await getProductByBarcode(barcode);
    if (!product) {
      const q = brand ? `${brand} ${name}` : name;
      const r = await searchInstamart(q, 3);
      // Pick the best match: same brand if possible
      product =
        r.products.find(
          (p) =>
            brand &&
            p.brand.toLowerCase().includes(brand.toLowerCase().slice(0, 6)),
        ) ?? r.products[0] ?? null;
    }

    if (!product) return null;

    return {
      ingredients: product.ingredients,
      nutritionalInfo: product.nutritionalInfo,
      imageUrl: product.imageUrl,
      price: product.price,
    };
  } catch {
    return null;
  }
}
