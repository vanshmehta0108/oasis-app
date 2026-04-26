import { unstable_cache } from "next/cache";
import {
  getTrendingProducts,
  getWorstRated,
  getRecentProducts,
  getProductCount,
  getFlaggedCount,
  getCategoryCounts,
} from "@/lib/db";
import type { Product } from "@/lib/mockData";
import HomeClient from "./HomeClient";

// Cache homepage data for 2 minutes — products/stats change infrequently
// and the client-side scan count still updates instantly from context.
const getHomeData = unstable_cache(
  async () => {
    const [trending, worst, recent, productCount, flaggedCount, catCounts] = await Promise.all([
      getTrendingProducts(6).catch(() => []),
      getWorstRated(4).catch(() => []),
      getRecentProducts(4).catch(() => []),
      getProductCount().catch(() => 0),
      getFlaggedCount().catch(() => 0),
      getCategoryCounts().catch(() => ({})),
    ]);
    return { trending, worst, recent, productCount, flaggedCount, catCounts };
  },
  ["home-data"],
  { revalidate: 120 },
);

function mapDbProduct(p: Record<string, unknown>): Product {
  const analysis = p.analysis as Record<string, unknown> | null;
  return {
    id: (p.barcode as string) || (p.id as string),
    barcode: (p.barcode as string) || "",
    name: (p.name as string) || "",
    brand: (p.brand as string) || "Unknown",
    category: (p.category as string) || "food",
    ingredients: (p.ingredients as string[]) || [],
    safety_score: p.safety_score != null ? (p.safety_score as number) : null,
    grade: ((p.score_grade as string) || null) as Product["grade"],
    image_url: (p.image_url as string) || "",
    analysis: analysis
      ? { summary: (analysis.summary as string) || "", ingredients: [], warnings: (analysis.warnings as string[]) || [], healthier_alternative: (analysis.healthier_alternative as string) || "" }
      : { summary: "", ingredients: [], warnings: [], healthier_alternative: "" },
  };
}

export default async function Home() {
  const { trending, worst, recent, productCount, flaggedCount, catCounts } = await getHomeData();

  return (
    <HomeClient
      initialTrending={(trending as Record<string, unknown>[]).map(mapDbProduct)}
      initialWorst={(worst as Record<string, unknown>[]).map(mapDbProduct)}
      initialRecent={(recent as Record<string, unknown>[]).map(mapDbProduct)}
      initialProductCount={productCount}
      initialFlaggedCount={flaggedCount}
      initialCatCounts={catCounts}
    />
  );
}
