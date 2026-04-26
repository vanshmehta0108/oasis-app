import { unstable_cache } from "next/cache";
import { getProductByBarcode } from "@/lib/db";
import ProductClient from "./ProductClient";

// Cache product lookups for 5 minutes — products rarely change, and stale
// data is acceptable; analyze/re-score will update state client-side.
const getCachedProduct = unstable_cache(
  async (barcode: string) => {
    const p = await getProductByBarcode(barcode);
    if (!p) return null;
    // Serialise to plain object for the client boundary
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
