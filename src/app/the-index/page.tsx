// The Sift Index — a public, magazine-style data drop that runs once a
// week. Screenshot-friendly for press, partnership decks, and the "look at
// what India is actually scanning" pitch. Cached for an hour at the
// edge so anyone hitting the page after a tweet/share lands fast.

import { createClient } from "@supabase/supabase-js";
import { categories } from "@/lib/mockData";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Sparkles, TrendingDown, Award } from "lucide-react";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "The Sift Index — what India is actually scanning",
  description: "An honest look at what's inside the packaged food and skincare on Indian shelves. Updated weekly.",
};

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  beverage: "Beverages",
  snack: "Snacks",
  dairy: "Dairy",
  water: "Water",
  skincare: "Skincare",
};

interface Stat {
  label: string;
  value: string | number;
  hint?: string;
}

interface BrandRow {
  brand: string;
  avgScore: number;
  productCount: number;
}

interface IngredientRow {
  ingredient: string;
  flagged: number;
}

async function loadStats() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  // No service-role key = best-effort fallback. The page still renders
  // with whatever counts /api/stats already has cached.
  if (!url || !key) return null;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const [totalRes, flaggedRes, cleanRes, scoredRes] = await Promise.all([
    // Estimated count avoids the statement timeout that exact-count hits
    // on the full products table (~143k rows). Off by a few thousand,
    // not a few million — fine for a magazine stat block.
    sb.from("products").select("*", { count: "estimated", head: true }),
    sb.from("products").select("*", { count: "exact", head: true }).gt("safety_score", 0).lt("safety_score", 40),
    sb.from("products").select("*", { count: "exact", head: true }).gte("safety_score", 80),
    sb.from("products").select("*", { count: "exact", head: true }).not("safety_score", "is", null).gt("safety_score", 0),
  ]);

  const total = totalRes.count ?? 0;
  const scored = scoredRes.count ?? 0;
  const flagged = flaggedRes.count ?? 0;
  const clean = cleanRes.count ?? 0;

  // Per-category averages (one query each — cheap, runs once per hour).
  const cats = ["food", "beverage", "snack", "dairy", "skincare"] as const;
  const catData = await Promise.all(
    cats.map(async (cat) => {
      const { data } = await sb
        .from("products")
        .select("safety_score")
        .eq("category", cat)
        .not("safety_score", "is", null)
        .gt("safety_score", 0);
      const scores = (data ?? []).map((r) => r.safety_score as number);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return { category: cat, count: scores.length, avg };
    }),
  );

  // Top + bottom brands by average score, restricted to brands with at
  // least 5 scored products so a single low-scoring item can't take a
  // brand to the top of the list.
  const { data: brandRows } = await sb
    .from("products")
    .select("brand, safety_score")
    .not("safety_score", "is", null)
    .gt("safety_score", 0)
    .neq("brand", "Unknown")
    .neq("brand", "")
    .limit(10000);

  const brandAgg = new Map<string, { sum: number; n: number }>();
  for (const r of brandRows ?? []) {
    const brand = (r.brand as string).trim();
    if (!brand) continue;
    const score = r.safety_score as number;
    const cur = brandAgg.get(brand) ?? { sum: 0, n: 0 };
    cur.sum += score;
    cur.n += 1;
    brandAgg.set(brand, cur);
  }
  const brandRanked: BrandRow[] = Array.from(brandAgg.entries())
    .filter(([, v]) => v.n >= 5)
    .map(([brand, v]) => ({ brand, avgScore: Math.round(v.sum / v.n), productCount: v.n }));
  const topBrands = [...brandRanked].sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
  const bottomBrands = [...brandRanked].sort((a, b) => a.avgScore - b.avgScore).slice(0, 5);

  // Most-flagged ingredients across danger/warning ratings. We sample
  // ~3000 analysed products and tally; sufficient for a leaderboard,
  // not for academic claims.
  const { data: analysisRows } = await sb
    .from("products")
    .select("analysis")
    .not("analysis", "is", null)
    .gt("safety_score", 0)
    .lt("safety_score", 60)
    .limit(3000);

  const ingTally = new Map<string, number>();
  for (const r of analysisRows ?? []) {
    const a = r.analysis as Record<string, unknown> | null;
    if (!a) continue;
    const items = (a.ingredients as Array<{ name: string; risk?: string; risk_level?: string }>) || [];
    for (const ing of items) {
      const risk = ing.risk ?? ing.risk_level ?? "";
      if (risk !== "danger" && risk !== "warning") continue;
      const name = (ing.name ?? "").trim().toLowerCase();
      if (!name) continue;
      ingTally.set(name, (ingTally.get(name) ?? 0) + 1);
    }
  }
  const topIngredients: IngredientRow[] = Array.from(ingTally.entries())
    .map(([ingredient, flagged]) => ({ ingredient, flagged }))
    .sort((a, b) => b.flagged - a.flagged)
    .slice(0, 8);

  return { total, scored, flagged, clean, catData, topBrands, bottomBrands, topIngredients };
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className="rounded-2xl bg-white p-5 border border-black/[0.04]" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      <p className="text-[28px] font-bold text-black tabular-nums leading-none tracking-[-0.02em]">{stat.value}</p>
      <p className="text-[12px] font-semibold uppercase tracking-wider mt-2 text-black/55">{stat.label}</p>
      {stat.hint && <p className="text-[11px] text-black/45 mt-1">{stat.hint}</p>}
    </div>
  );
}

export default async function TheIndexPage() {
  const data = await loadStats();
  const stats: Stat[] = data
    ? [
        { label: "Products checked", value: data.total.toLocaleString(), hint: `${data.scored.toLocaleString()} scored` },
        { label: "We'd skip", value: data.flagged.toLocaleString(), hint: "score under 40" },
        { label: "Clean picks", value: data.clean.toLocaleString(), hint: "score 80+" },
      ]
    : [];

  return (
    <div className="min-h-dvh" style={{ background: "#F2F2F7" }}>
      <div className="max-w-3xl mx-auto px-5 pt-12 pb-32">
        {/* Back nav */}
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-black/55 mb-8">
          <ArrowLeft size={14} />
          Back to Sift
        </Link>

        {/* Header */}
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-black/45 mb-3">The Sift Index</p>
        <h1 className="text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-black mb-4">
          What India is actually <span style={{ color: "#007AFF" }}>scanning.</span>
        </h1>
        <p className="text-[16px] leading-relaxed text-black/65 max-w-xl mb-12">
          An honest look at the packaged food and skincare on Indian shelves. We score every product on its ingredients — what FSSAI permits, what the EU has banned, what we&apos;d feed our families. Updated weekly.
        </p>

        {data ? (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
              {stats.map((s) => <StatCard key={s.label} stat={s} />)}
            </div>

            {/* Category averages */}
            <section className="mb-12">
              <h2 className="text-[20px] font-bold text-black mb-4">Average score by category</h2>
              <div className="rounded-2xl bg-white border border-black/[0.04] overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                {data.catData.map((c, i) => {
                  const tone =
                    (c.avg ?? 0) >= 70 ? "#1E8040" :
                    (c.avg ?? 0) >= 50 ? "#B87800" :
                    (c.avg ?? 0) >= 30 ? "#CC5200" : "#CC1010";
                  const label = CATEGORY_LABELS[c.category] ?? c.category;
                  const pct = Math.min(100, Math.max(0, c.avg ?? 0));
                  return (
                    <div key={c.category} className={`px-5 py-4 ${i > 0 ? "border-t border-black/[0.04]" : ""}`}>
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[14px] font-semibold text-black">{label}</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[20px] font-bold tabular-nums" style={{ color: tone }}>{c.avg ?? "—"}</span>
                          <span className="text-[11px] text-black/45">avg / 100</span>
                          <span className="text-[11px] text-black/35 ml-2">{c.count.toLocaleString()} scored</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-black/[0.05] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Top + bottom brands */}
            <section className="grid sm:grid-cols-2 gap-4 mb-12">
              <div>
                <h2 className="text-[16px] font-bold text-black mb-3 flex items-center gap-2">
                  <Award size={16} style={{ color: "#1E8040" }} />
                  Brands we&apos;d buy
                </h2>
                <div className="rounded-2xl bg-white border border-black/[0.04] overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  {data.topBrands.map((b, i) => (
                    <div key={b.brand} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-black/[0.04]" : ""}`}>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-black truncate">{b.brand}</p>
                        <p className="text-[10px] text-black/45 mt-0.5">{b.productCount} scored</p>
                      </div>
                      <span className="text-[16px] font-bold tabular-nums" style={{ color: "#1E8040" }}>{b.avgScore}</span>
                    </div>
                  ))}
                  {data.topBrands.length === 0 && (
                    <p className="px-4 py-6 text-[12px] text-black/45 text-center">Not enough scored data yet.</p>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-[16px] font-bold text-black mb-3 flex items-center gap-2">
                  <TrendingDown size={16} style={{ color: "#CC1010" }} />
                  Brands we&apos;d watch
                </h2>
                <div className="rounded-2xl bg-white border border-black/[0.04] overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  {data.bottomBrands.map((b, i) => (
                    <div key={b.brand} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-black/[0.04]" : ""}`}>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-black truncate">{b.brand}</p>
                        <p className="text-[10px] text-black/45 mt-0.5">{b.productCount} scored</p>
                      </div>
                      <span className="text-[16px] font-bold tabular-nums" style={{ color: "#CC1010" }}>{b.avgScore}</span>
                    </div>
                  ))}
                  {data.bottomBrands.length === 0 && (
                    <p className="px-4 py-6 text-[12px] text-black/45 text-center">Not enough scored data yet.</p>
                  )}
                </div>
              </div>
            </section>

            {/* Most flagged ingredients */}
            {data.topIngredients.length > 0 && (
              <section className="mb-12">
                <h2 className="text-[20px] font-bold text-black mb-2 flex items-center gap-2">
                  <ShieldAlert size={18} style={{ color: "#CC5200" }} />
                  Most-flagged ingredients
                </h2>
                <p className="text-[13px] text-black/55 mb-4">In products we&apos;d eat occasionally or skip. Counted across our scored database.</p>
                <div className="rounded-2xl bg-white border border-black/[0.04] overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                  {data.topIngredients.map((row, i) => (
                    <div key={row.ingredient} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-black/[0.04]" : ""}`}>
                      <span className="text-[13px] text-black capitalize">{row.ingredient}</span>
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: "#CC5200" }}>{row.flagged.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Categories link-out */}
            <section>
              <h2 className="text-[16px] font-bold text-black mb-3 flex items-center gap-2">
                <Sparkles size={16} style={{ color: "#007AFF" }} />
                Browse by category
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {categories.map((cat) => (
                  <Link
                    key={cat.name}
                    href={`/search?category=${cat.name}`}
                    className="rounded-xl bg-white px-3 py-3 text-center text-[13px] font-medium text-black border border-black/[0.04]"
                    style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-2xl bg-white border border-black/[0.04] p-8 text-center">
            <p className="text-[14px] text-black/55">Stats temporarily unavailable.</p>
          </div>
        )}

        <p className="text-[11px] text-black/40 mt-12 text-center">
          Updated every hour. Powered by Sift — scan any Indian packet for an honest verdict.
        </p>
      </div>
    </div>
  );
}
