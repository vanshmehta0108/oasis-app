"use client";

import { useState, useCallback, useEffect } from "react";
import { BarChart3, Package, Download, Plus, Trash2, Search, RefreshCw, LogOut, ChevronLeft, ChevronRight } from "lucide-react";

type Tab = "dashboard" | "products" | "import" | "add";

interface Stats {
  total: number;
  analyzed: number;
  with_ingredients: number;
  unanalyzed: number;
  by_category: Record<string, number>;
  by_source: Record<string, number>;
  by_grade: Record<string, number>;
}

interface Product {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  safety_score: number | null;
  score_grade: string | null;
  source: string;
  created_at: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "#34C759", B: "#A2D44F", C: "#FF9F0A", D: "#FF6B00", E: "#FF3B30",
};

const BRAND_PRESETS = [
  { label: "Parle", queries: ["parle-g", "parle hide & seek", "parle monaco"] },
  { label: "Amul", queries: ["amul butter", "amul milk", "amul cheese"] },
  { label: "Britannia", queries: ["britannia good day", "britannia marie", "britannia tiger"] },
  { label: "Maggi", queries: ["maggi noodles", "maggi masala"] },
  { label: "Haldirams", queries: ["haldiram bhujia", "haldiram namkeen", "haldiram aloo bhujia"] },
  { label: "Dabur", queries: ["dabur chyawanprash", "dabur honey", "dabur real juice"] },
  { label: "Patanjali", queries: ["patanjali atta", "patanjali ghee", "patanjali dant kanti"] },
  { label: "ITC", queries: ["sunfeast dark fantasy", "bingo chips", "aashirvaad atta"] },
  { label: "Nestle", queries: ["nestle kitkat", "munch chocolate", "milkmaid"] },
  { label: "Cadbury", queries: ["cadbury dairy milk", "oreo india", "cadbury 5star"] },
  { label: "Kurkure", queries: ["kurkure masala", "kurkure noodles"] },
  { label: "Lay's India", queries: ["lays india", "uncle chips"] },
];

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  // Products tab
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(1);
  const [productPages, setProductPages] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Add product tab
  const [addBarcode, setAddBarcode] = useState("");
  const [addResult, setAddResult] = useState<string | null>(null);

  const addLog = (msg: string) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const fetchStats = useCallback(async (adminKey: string) => {
    try {
      const res = await fetch(`/api/admin/stats?key=${adminKey}`);
      if (!res.ok) throw new Error("Failed");
      setStats(await res.json());
    } catch { addLog("Failed to fetch stats"); }
  }, []);

  const fetchProducts = useCallback(async (page = 1, search = "") => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams({ page: String(page), key });
      if (search) params.set("q", search);
      const res = await fetch(`/api/admin/products?${params}`);
      const data = await res.json();
      setProducts(data.products || []);
      setProductTotal(data.total || 0);
      setProductPage(data.page || 1);
      setProductPages(data.pages || 1);
    } catch { addLog("Failed to fetch products"); }
    setLoadingProducts(false);
  }, [key]);

  useEffect(() => {
    if (tab === "products" && authenticated) fetchProducts(1, productSearch);
  }, [tab, authenticated, fetchProducts, productSearch]);

  const handleAuth = async () => {
    const res = await fetch(`/api/admin/stats?key=${key}`);
    if (res.ok) {
      setAuthenticated(true);
      setStats(await res.json());
      addLog("Authenticated");
    } else {
      addLog("Invalid admin key");
    }
  };

  const runImport = async (queries?: string[]) => {
    setLoading("import");
    addLog(`Starting import${queries ? ` (${queries.join(", ")})` : " (broad India search)"}...`);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify(queries ? { queries, page_size: 50, max_pages: 3 } : { page_size: 50, max_pages: 3 }),
      });
      const data = await res.json();
      addLog(`Done: ${data.imported} imported, ${data.skipped} skipped, ${data.failed} failed`);
      fetchStats(key);
    } catch (err) {
      addLog(`Import error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(null);
  };

  const runAnalysis = async (batchSize: number) => {
    setLoading("analyze");
    addLog(`Analyzing batch of ${batchSize}...`);
    try {
      const res = await fetch("/api/admin/analyze-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ batch_size: batchSize }),
      });
      const data = await res.json();
      addLog(`Done: ${data.analyzed} analyzed, ${data.failed} failed`);
      data.results?.forEach((r: { name: string; score: number; grade: string }) =>
        addLog(`  ${r.name}: ${r.score}/100 (${r.grade})`)
      );
      fetchStats(key);
    } catch (err) {
      addLog(`Analysis error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(null);
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    const res = await fetch("/api/admin/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-key": key },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      addLog(`Deleted: ${name}`);
      fetchProducts(productPage, productSearch);
      fetchStats(key);
    }
  };

  const addProductByBarcode = async () => {
    if (!addBarcode.trim()) return;
    setAddResult("Looking up...");
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: addBarcode.trim() }),
      });
      const data = await res.json();
      if (data.found) {
        setAddResult(`✓ Found & saved: ${data.product.name} (${data.source})`);
        setAddBarcode("");
        fetchStats(key);
      } else {
        setAddResult("✗ Not found in any database");
      }
    } catch {
      setAddResult("✗ Lookup failed");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-dvh bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#007AFF] flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Sift Admin</h1>
            <p className="text-sm mt-1" style={{ color: "#8E8E93" }}>Enter your admin key</p>
          </div>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="Admin secret key"
            className="w-full px-4 py-3 rounded-xl text-white placeholder:text-[#636366] focus:outline-none text-sm"
            style={{ background: "#1C1C1E", border: "1px solid #3A3A3C" }}
          />
          <button
            onClick={handleAuth}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm"
            style={{ background: "#007AFF" }}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "dashboard" as Tab, label: "Dashboard", Icon: BarChart3 },
    { id: "products" as Tab, label: "Products", Icon: Package },
    { id: "import" as Tab, label: "Import", Icon: Download },
    { id: "add" as Tab, label: "Add Product", Icon: Plus },
  ];

  return (
    <div className="min-h-dvh bg-black text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b" style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(20px)", borderColor: "#3A3A3C" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#007AFF] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="font-semibold text-sm">Sift Admin</span>
        </div>
        <button onClick={() => setAuthenticated(false)} className="p-1.5 rounded-lg" style={{ color: "#8E8E93" }}>
          <LogOut size={16} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b overflow-x-auto" style={{ borderColor: "#3A3A3C" }}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium shrink-0 border-b-2 transition-colors"
            style={tab === id
              ? { color: "#007AFF", borderColor: "#007AFF" }
              : { color: "#8E8E93", borderColor: "transparent" }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 pb-24 max-w-4xl mx-auto space-y-4">

        {/* DASHBOARD TAB */}
        {tab === "dashboard" && stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Products", value: stats.total, color: "#FFFFFF" },
                { label: "AI Analyzed", value: stats.analyzed, color: "#34C759" },
                { label: "Has Ingredients", value: stats.with_ingredients, color: "#007AFF" },
                { label: "Needs Analysis", value: stats.unanalyzed, color: "#FF9F0A" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl p-4" style={{ background: "#1C1C1E" }}>
                  <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</div>
                  <div className="text-xs mt-1" style={{ color: "#8E8E93" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {Object.keys(stats.by_grade).length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "#1C1C1E" }}>
                <h2 className="text-xs font-semibold mb-3" style={{ color: "#8E8E93" }}>GRADE DISTRIBUTION</h2>
                <div className="flex gap-2 h-24 items-end">
                  {["A", "B", "C", "D", "E"].map((grade) => {
                    const count = stats.by_grade[grade] || 0;
                    const pct = stats.analyzed ? Math.max((count / stats.analyzed) * 100, 4) : 4;
                    return (
                      <div key={grade} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs" style={{ color: "#8E8E93" }}>{count}</span>
                        <div className="w-full rounded-t-lg" style={{ height: `${pct}%`, background: GRADE_COLORS[grade] }} />
                        <span className="text-xs font-bold" style={{ color: GRADE_COLORS[grade] }}>{grade}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={{ background: "#1C1C1E" }}>
                <h2 className="text-xs font-semibold mb-3" style={{ color: "#8E8E93" }}>BY CATEGORY</h2>
                <div className="space-y-1.5">
                  {Object.entries(stats.by_category).sort(([, a], [, b]) => b - a).map(([cat, count]) => (
                    <div key={cat} className="flex justify-between text-sm">
                      <span className="capitalize">{cat.replace("_", " ")}</span>
                      <span style={{ color: "#8E8E93" }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "#1C1C1E" }}>
                <h2 className="text-xs font-semibold mb-3" style={{ color: "#8E8E93" }}>BY SOURCE</h2>
                <div className="space-y-1.5">
                  {Object.entries(stats.by_source).sort(([, a], [, b]) => b - a).map(([src, count]) => (
                    <div key={src} className="flex justify-between text-sm">
                      <span className="capitalize">{src}</span>
                      <span style={{ color: "#8E8E93" }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={() => fetchStats(key)} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl" style={{ background: "#1C1C1E", color: "#007AFF" }}>
              <RefreshCw size={14} /> Refresh Stats
            </button>
          </>
        )}

        {/* PRODUCTS TAB */}
        {tab === "products" && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "#1C1C1E", border: "1px solid #3A3A3C" }}>
                <Search size={14} style={{ color: "#636366" }} />
                <input
                  type="text"
                  placeholder="Search by name, brand, or barcode..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchProducts(1, productSearch)}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-[#636366] focus:outline-none"
                />
              </div>
              <button onClick={() => fetchProducts(1, productSearch)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#007AFF", color: "white" }}>
                Search
              </button>
            </div>

            <div className="text-xs" style={{ color: "#8E8E93" }}>{productTotal.toLocaleString()} products total</div>

            <div className="rounded-2xl overflow-hidden" style={{ background: "#1C1C1E" }}>
              {loadingProducts ? (
                <div className="p-8 text-center text-sm" style={{ color: "#8E8E93" }}>Loading...</div>
              ) : products.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: "#8E8E93" }}>No products found</div>
              ) : (
                products.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? "1px solid #3A3A3C" : "none" }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs truncate" style={{ color: "#8E8E93" }}>{p.brand} · {p.barcode} · {p.category}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.score_grade ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${GRADE_COLORS[p.score_grade]}20`, color: GRADE_COLORS[p.score_grade] }}>
                          {p.score_grade}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#2C2C2E", color: "#636366" }}>—</span>
                      )}
                      <button onClick={() => deleteProduct(p.id, p.name)} className="p-1.5 rounded-lg transition" style={{ color: "#FF3B30" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {productPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => fetchProducts(productPage - 1, productSearch)}
                  disabled={productPage <= 1}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm disabled:opacity-40"
                  style={{ background: "#1C1C1E", color: "#007AFF" }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="text-xs" style={{ color: "#8E8E93" }}>Page {productPage} of {productPages}</span>
                <button
                  onClick={() => fetchProducts(productPage + 1, productSearch)}
                  disabled={productPage >= productPages}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm disabled:opacity-40"
                  style={{ background: "#1C1C1E", color: "#007AFF" }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}

        {/* IMPORT TAB */}
        {tab === "import" && (
          <>
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1C1C1E" }}>
              <h2 className="font-semibold">Broad Import</h2>
              <p className="text-sm" style={{ color: "#8E8E93" }}>Pulls all products tagged "India" from Open Food Facts. No AI cost — just metadata + ingredients.</p>
              <button
                onClick={() => runImport()}
                disabled={!!loading}
                className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
                style={{ background: "#007AFF", color: "white" }}
              >
                {loading === "import" ? "Importing..." : "Import All Indian Products (OFF)"}
              </button>
            </div>

            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1C1C1E" }}>
              <h2 className="font-semibold">Import by Brand</h2>
              <p className="text-sm" style={{ color: "#8E8E93" }}>Click a brand to import its top products from Open Food Facts.</p>
              <div className="grid grid-cols-3 gap-2">
                {BRAND_PRESETS.map((brand) => (
                  <button
                    key={brand.label}
                    onClick={() => runImport(brand.queries)}
                    disabled={!!loading}
                    className="py-2 px-3 rounded-xl text-sm font-medium disabled:opacity-50"
                    style={{ background: "#2C2C2E", color: "#FFFFFF" }}
                  >
                    {brand.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1C1C1E" }}>
              <h2 className="font-semibold">AI Analysis</h2>
              <p className="text-sm" style={{ color: "#8E8E93" }}>Runs AI scoring on unanalyzed products. Uses Gemini Flash. Run after importing.</p>
              <div className="flex gap-2">
                {[5, 15, 30].map((n) => (
                  <button
                    key={n}
                    onClick={() => runAnalysis(n)}
                    disabled={!!loading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ background: "#34C759", color: "#000000" }}
                  >
                    {loading === "analyze" ? "..." : `Analyze ${n}`}
                  </button>
                ))}
              </div>
            </div>

            {log.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "#1C1C1E" }}>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xs font-semibold" style={{ color: "#8E8E93" }}>ACTIVITY LOG</h2>
                  <button onClick={() => setLog([])} className="text-xs" style={{ color: "#636366" }}>Clear</button>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs" style={{ color: "#8E8E93" }}>
                  {log.map((entry, i) => <div key={i}>{entry}</div>)}
                </div>
              </div>
            )}
          </>
        )}

        {/* ADD PRODUCT TAB */}
        {tab === "add" && (
          <div className="rounded-2xl p-4 space-y-4" style={{ background: "#1C1C1E" }}>
            <h2 className="font-semibold">Add Product by Barcode</h2>
            <p className="text-sm" style={{ color: "#8E8E93" }}>Enter any barcode. Sift will check Open Food Facts, save it to the database, and queue it for AI analysis.</p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 8901058857279"
                value={addBarcode}
                onChange={(e) => setAddBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addProductByBarcode()}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder:text-[#636366] focus:outline-none"
                style={{ background: "#2C2C2E", border: "1px solid #3A3A3C" }}
              />
              <button
                onClick={addProductByBarcode}
                disabled={!addBarcode.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: "#007AFF", color: "white" }}
              >
                Add
              </button>
            </div>
            {addResult && (
              <p className="text-sm" style={{ color: addResult.startsWith("✓") ? "#34C759" : "#FF3B30" }}>
                {addResult}
              </p>
            )}

            <div className="pt-2 border-t" style={{ borderColor: "#3A3A3C" }}>
              <p className="text-xs mb-3" style={{ color: "#8E8E93" }}>Common Indian product barcodes to try:</p>
              <div className="space-y-1.5">
                {[
                  { name: "Parle-G Biscuits", barcode: "8901719110017" },
                  { name: "Maggi 2-Minute Noodles", barcode: "8901058857279" },
                  { name: "Amul Butter", barcode: "8901088000010" },
                  { name: "Kurkure Masala Munch", barcode: "8901491503099" },
                  { name: "Cadbury Dairy Milk", barcode: "7622210952059" },
                ].map((p) => (
                  <button
                    key={p.barcode}
                    onClick={() => { setAddBarcode(p.barcode); setAddResult(null); }}
                    className="w-full flex justify-between items-center px-3 py-2 rounded-xl text-sm text-left"
                    style={{ background: "#2C2C2E" }}
                  >
                    <span>{p.name}</span>
                    <span className="font-mono text-xs" style={{ color: "#636366" }}>{p.barcode}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
