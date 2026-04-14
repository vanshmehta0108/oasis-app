"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { SearchBar } from "@/components/SearchBar";
import { ProductCard } from "@/components/ProductCard";
import type { Product } from "@/lib/mockData";
import { searchProducts as searchSupabase } from "@/lib/db";
import { Search, TrendingUp, Globe, Loader2, Database } from "lucide-react";
import Link from "next/link";
import { SkeletonSearchResults } from "@/components/Skeleton";

const popularSearches = ["Maggi", "Bournvita", "Kurkure", "Sunscreen", "Baby food", "Atta"];

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
    safety_score: (p.safety_score as number) || 0,
    grade: ((p.score_grade as string) || "C") as Product["grade"],
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

  // Search Supabase + Open Food Facts with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setDbResults([]);
      setOffResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setDbLoading(true);
      setOffLoading(true);

      // Search Supabase (our DB)
      try {
        const supaResults = await searchSupabase(query, category === "All" ? undefined : category);
        setDbResults(supaResults.map((d) => mapDbToProduct(d as unknown as Record<string, unknown>)));
      } catch {
        setDbResults([]);
      } finally {
        setDbLoading(false);
      }

      // Search Open Food Facts
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&countries_tags=en:india&json=1&page_size=10&fields=code,product_name,brands,categories,ingredients_text,image_url`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const mapped: OFFResult[] = (data.products || [])
            .filter((p: { product_name?: string }) => p.product_name)
            .map((p: { code: string; product_name: string; brands?: string; categories?: string; ingredients_text?: string; image_url?: string }): OFFResult => ({
              id: `off-${p.code}`,
              barcode: p.code,
              name: p.product_name,
              brand: p.brands || "Unknown",
              category: p.categories?.split(",")[0]?.trim() || "Food",
              ingredients: p.ingredients_text ? p.ingredients_text.split(/,\s*/).filter(Boolean) : [],
              safety_score: 0,
              grade: "C" as const,
              image_url: p.image_url || "",
              analysis: { summary: "Tap to analyze", ingredients: [], warnings: [], healthier_alternative: "" },
            }));
          setOffResults(mapped);
        }
      } catch {
        // ignore
      } finally {
        setOffLoading(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, category]);

  // Combine results — DB first, then OFF (excluding duplicates by barcode)
  const dbBarcodes = new Set(dbResults.map((p) => p.barcode));
  const uniqueOff = offResults.filter((p) => !dbBarcodes.has(p.barcode));
  const results: Product[] = [...dbResults, ...uniqueOff as unknown as Product[]];
  const isLoading = dbLoading || offLoading;
  const showEmpty = !query && category === "All";

  return (
    <div className="px-4 pt-12 pb-24 max-w-lg mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-[family-name:var(--font-instrument)] text-2xl text-oasis-text mb-4"
      >
        Search
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
              className="w-20 h-20 rounded-full bg-oasis-card border border-oasis-border flex items-center justify-center mb-4"
            >
              <span className="text-4xl">🔍</span>
            </motion.div>
            <motion.p variants={fadeUp} className="text-sm text-oasis-muted max-w-xs mb-6">
              Search for any product or brand to see its safety analysis
            </motion.p>

            <motion.div variants={fadeUp} className="w-full">
              <div className="flex items-center gap-2 mb-3 justify-center">
                <TrendingUp size={14} className="text-oasis-green" />
                <span className="text-xs font-semibold text-oasis-muted">Popular Searches</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {popularSearches.map((term) => (
                  <motion.button
                    key={term}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setQuery(term)}
                    className="px-3.5 py-1.5 rounded-full bg-oasis-card border border-oasis-border text-xs font-medium text-oasis-text hover:border-oasis-green/30 transition-colors"
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
              No results for &ldquo;{query}&rdquo;
            </p>
            <p className="text-xs text-oasis-muted max-w-xs">
              Try a different search term, or scan the product barcode.
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
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              {dbResults.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400/70">
                  <Database size={10} /> {dbResults.length} from Oasis DB
                </span>
              )}
              {uniqueOff.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-oasis-green/70">
                  <Globe size={10} /> {uniqueOff.length} from Open Food Facts
                </span>
              )}
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
