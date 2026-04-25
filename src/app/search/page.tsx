"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { SearchBar } from "@/components/SearchBar";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/mockData";
import { searchProducts as searchSupabase, getProductsByCategory } from "@/lib/db";
import { Search, TrendingUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { SkeletonSearchResults } from "@/components/Skeleton";
import { useLanguage } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

// Hardcoded suggestion seeds — shown only on the blank empty state when
// the user has no history yet. Labeled as "Try searching" so we never
// misrepresent them as real popularity data.
const searchSuggestions = ["Maggi", "Bournvita", "Kurkure", "Sunscreen", "Baby food", "Atta"];

function mapOFFCategory(raw: string | undefined): string {
  if (!raw) return "Food";
  const lowered = raw.toLowerCase();
  if (/beverag|drink|juice|water|soda|tea|coffee|milk/.test(lowered)) return "Beverages";
  if (/snack|cereal|chocolate|confectioner|biscuit|crisps|chips|namkeen|mithai/.test(lowered)) return "Snacks";
  if (/baby|infant|toddler/.test(lowered)) return "Baby";
  if (/cosmetic|skincare|skin-care|beauty|lotion|cream|soap|shampoo/.test(lowered)) return "Skincare";
  if (/household|cleaning|detergent/.test(lowered)) return "Household";
  return "Food";
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface OFFResult {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  ingredients: string[];
  safety_score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  image_url: string;
  analysis: { summary: string; ingredients: []; warnings: []; healthier_alternative: string };
}

function mapDbToProduct(p: Record<string, unknown>): Product {
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
      ? {
          summary: (analysis.summary as string) || "",
          ingredients: [],
          warnings: (analysis.warnings as string[]) || [],
          healthier_alternative: (analysis.healthier_alternative as string) || "",
        }
      : { summary: "Tap to analyze", ingredients: [], warnings: [], healthier_alternative: "" },
  };
}

function SearchContent() {
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const initialCategory = searchParams.get("category") || "All";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [dbResults, setDbResults] = useState<Product[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [offResults, setOffResults] = useState<OFFResult[]>([]);
  const [offLoading, setOffLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const handleSearch = useCallback((q: string) => setQuery(q), []);
  const handleCategory = useCallback((c: string) => setCategory(c), []);

  // Category browse — load all products in category when no search query.
  // Generation counter guards against stale responses when the user switches
  // categories faster than the DB responds.
  const browseGen = useRef(0);
  useEffect(() => {
    if (query.length >= 2 || category === "All") return;
    browseGen.current += 1;
    const gen = browseGen.current;
    setDbLoading(true);
    setOffResults([]);
    getProductsByCategory(category)
      .then((rows) => {
        if (gen !== browseGen.current) return; // stale
        setDbResults(rows.map((d) => mapDbToProduct(d as unknown as Record<string, unknown>)));
      })
      .catch(() => {
        if (gen !== browseGen.current) return;
        setDbResults([]);
      })
      .finally(() => {
        if (gen !== browseGen.current) return;
        setDbLoading(false);
      });
  }, [category, query]);

  // Search Supabase + Open Food Facts with debounce
  const searchGen = useRef(0);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      if (category === "All") {
        setDbResults([]);
        setOffResults([]);
      }
      return;
    }
    searchGen.current += 1;
    const gen = searchGen.current;
    const controller = new AbortController();
    debounceRef.current = setTimeout(async () => {
      setDbLoading(true);
      setOffLoading(true);

      // Search Supabase (our DB)
      try {
        const supaResults = await searchSupabase(query, category === "All" ? undefined : category);
        if (gen !== searchGen.current) return;
        setDbResults(supaResults.map((d) => mapDbToProduct(d as unknown as Record<string, unknown>)));
      } catch {
        if (gen !== searchGen.current) return;
        setDbResults([]);
      } finally {
        if (gen === searchGen.current) setDbLoading(false);
      }

      // Search Open Food Facts
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&countries_tags=en:india&json=1&page_size=10&fields=code,product_name,brands,categories,ingredients_text,image_url`;
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (gen !== searchGen.current) return;
          const mapped: OFFResult[] = (data.products || [])
            .filter((p: { product_name?: string; ingredients_text?: string; code?: string }) =>
              p.product_name && p.code && p.ingredients_text && p.ingredients_text.trim().length > 10
            )
            .map((p: { code: string; product_name: string; brands?: string; categories?: string; ingredients_text?: string; image_url?: string }): OFFResult => ({
              id: `off-${p.code}`,
              barcode: p.code,
              name: p.product_name,
              brand: p.brands || "Unknown",
              category: mapOFFCategory(p.categories),
              ingredients: p.ingredients_text ? p.ingredients_text.split(/,\s*/).filter(Boolean) : [],
              safety_score: 0,
              grade: "C" as const,
              image_url: p.image_url || "",
              analysis: { summary: "Tap to analyze", ingredients: [], warnings: [], healthier_alternative: "" },
            }));
          setOffResults(mapped);
        }
      } catch {
        // ignore abort/network errors — stale request is already discarded
      } finally {
        if (gen === searchGen.current) setOffLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      controller.abort();
    };
  }, [query, category]);

  // Combine results — DB first, then OFF (excluding duplicates by barcode)
  const dbBarcodes = new Set(dbResults.map((p) => p.barcode));
  const uniqueOff = offResults.filter((p) => !dbBarcodes.has(p.barcode));
  const results: Product[] = [...dbResults, ...uniqueOff as unknown as Product[]];
  const isLoading = dbLoading || offLoading;
  const isBrowsingCategory = category !== "All" && query.length < 2;
  const showEmpty = !query && category === "All";

  return (
    <div className="px-4 pt-14 pb-24 max-w-lg mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[28px] font-bold text-black tracking-tight mb-4"
      >
        {isBrowsingCategory ? category : t('search', language)}
      </motion.h1>

      <SearchBar
        onSearch={handleSearch}
        onCategoryChange={handleCategory}
        selectedCategory={category}
      />

      <div className="mt-4">
        {showEmpty && !results.length ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <motion.div
              variants={fadeUp}
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: "#F2F2F7" }}
            >
              <span className="text-4xl">🔍</span>
            </motion.div>
            <motion.p variants={fadeUp} className="text-[14px] max-w-xs mb-6" style={{ color: "#8E8E93" }}>
              Search for any product or brand to see its safety analysis
            </motion.p>

            <motion.div variants={fadeUp} className="w-full">
              <div className="flex items-center gap-2 mb-3 justify-center">
                <TrendingUp size={14} style={{ color: "#007AFF" }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8E8E93" }}>Try Searching</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {searchSuggestions.map((term) => (
                  <motion.button
                    key={term}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setQuery(term)}
                    className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-black"
                    style={{ background: "#FFFFFF", border: "1px solid #E5E5EA" }}
                  >
                    {term}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : isLoading && results.length === 0 ? (
          <SkeletonSearchResults />
        ) : results.length === 0 && !isLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
            role="status"
          >
            <span className="text-5xl mb-3">😔</span>
            <p className="text-sm font-medium text-oasis-text mb-1">
              {isBrowsingCategory
                ? `No products in ${category} yet`
                : `${t('no_results', language)} "${query}"`}
            </p>
            <p className="text-xs text-oasis-muted max-w-xs">
              {isBrowsingCategory
                ? "Scan a product to add the first one to this category."
                : "Try a different search term, or scan the product barcode."}
            </p>
            <Link
              href="/scan"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-oasis-green text-oasis-black text-sm font-semibold"
            >
              <Search size={14} aria-hidden="true" />
              Scan Instead
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={stagger}
            className="space-y-2"
          >
            <motion.div variants={fadeUp} className="flex items-center gap-2 mb-1">
              <p className="text-[11px] text-oasis-muted">
                {results.length} {isBrowsingCategory ? "product" : "result"}{results.length !== 1 ? "s" : ""}
              </p>
              {isLoading && <Loader2 size={12} className="text-oasis-green animate-spin" />}
            </motion.div>
            {results.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
