export const runtime = "nodejs";
export const revalidate = 300; // 5-min CDN cache

import { NextRequest, NextResponse } from "next/server";
import { searchInstamart, getProductByBarcode, getInstamartPrice, buildStaticSearchUrl } from "@/lib/swiggy";
import { checkRateLimit } from "@/lib/rateLimit";

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function corsHeaders() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// GET /api/swiggy?barcode=xxx          → barcode lookup
// GET /api/swiggy?name=xxx&brand=yyy   → name search (returns top 5)
// GET /api/swiggy?price=1&barcode=xxx&name=yyy&brand=zzz → price only
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`swiggy:${ip}`, { capacity: 30, refillPerMin: 30 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.retryAfter },
      { status: 429, headers: corsHeaders() },
    );
  }

  const { searchParams } = req.nextUrl;
  const barcode = searchParams.get("barcode");
  const name = searchParams.get("name");
  const brand = searchParams.get("brand") ?? undefined;
  const priceOnly = searchParams.get("price") === "1";

  if (!barcode && !name) {
    return NextResponse.json(
      { error: "Provide barcode or name" },
      { status: 400, headers: corsHeaders() },
    );
  }

  try {
    // Price-only mode: used by BuyOnline component to show live INR price
    if (priceOnly) {
      const price = await getInstamartPrice(barcode, name ?? "", brand);
      return NextResponse.json(
        {
          found: !!price,
          price: price ?? null,
          staticUrl: buildStaticSearchUrl(name ?? barcode ?? "", brand),
        },
        { headers: { ...corsHeaders(), "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
      );
    }

    // Barcode lookup
    if (barcode) {
      const product = await getProductByBarcode(barcode);
      return NextResponse.json(
        { found: !!product, product: product ?? null, staticUrl: buildStaticSearchUrl(name ?? "", brand) },
        { headers: corsHeaders() },
      );
    }

    // Name search
    const results = await searchInstamart(`${brand ? brand + " " : ""}${name}`, 5);
    return NextResponse.json(
      { ...results, staticUrl: buildStaticSearchUrl(name!, brand) },
      { headers: corsHeaders() },
    );
  } catch (err) {
    console.error("swiggy route error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Swiggy lookup failed", staticUrl: buildStaticSearchUrl(name ?? "", brand) },
      { status: 500, headers: corsHeaders() },
    );
  }
}
