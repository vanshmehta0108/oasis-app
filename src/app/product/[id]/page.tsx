import { unstable_cache } from "next/cache";
import { getProductByBarcode } from "@/lib/db";
import { masterLookup } from "@/lib/master";
import ProductClient from "./ProductClient";

// Cache product lookups for 5 minutes — products rarely change, and stale
// data is acceptable; analyze/re-score will update state client-side.
//
// CRITICAL: keep masterLookup() server-side only. It pulls in the
// ~90MB master-products.json. If a client component imports it, every
// page navigation ships those 90MB to the user's phone. The server
// boundary is the only thing keeping that off the wire.
const getCachedProduct = unstable_cache(
  async (barcode: string) => {
    // 1. Try the static master sheet first — zero cost, in-memory lookup.
    const m = masterLookup(barcode);
    if (m && m.safety_score !== null) {
      const merged = {
        id: barcode,
        barcode,
        name: m.name,
        brand: m.brand,
        category: m.category,
        ingredients: m.ingredients,
        safety_score: m.safety_score,
        score_grade: m.score_grade,
        grade: m.score_grade,
        image_url: m.image_url ?? null,
        fssai_license: (m as unknown as { fssai_license?: string | null }).fssai_license ?? null,
        analysis: m.analysis,
      };
      return JSON.parse(JSON.stringify(merged)) as Record<string, unknown>;
    }
    // 2. Fall back to Supabase.
    const p = await getProductByBarcode(barcode);
    if (!p) return null;
    return JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
  },
  ["product-by-barcode"],
  { revalidate: 300 }
);

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const initialProduct = await getCachedProduct(id);

  return <ProductClient id={id} initialProduct={initialProduct} />;
}
