"use client";

import { useState, useCallback } from "react";

interface Stats {
  total: number;
  analyzed: number;
  with_ingredients: number;
  unanalyzed: number;
  by_category: Record<string, number>;
  by_source: Record<string, number>;
  by_grade: Record<string, number>;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  queries_processed: number;
  errors: string[];
}

interface AnalyzeResult {
  success: boolean;
  analyzed: number;
  failed: number;
  results: { barcode: string; name: string; score: number; grade: string }[];
  errors: string[];
}

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const fetchStats = useCallback(async (adminKey: string) => {
    try {
      const res = await fetch(`/api/admin/stats?key=${adminKey}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data: Stats = await res.json();
      setStats(data);
      return data;
    } catch (err) {
      addLog(`Stats error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }, []);

  const handleAuth = async () => {
    const res = await fetch(`/api/admin/stats?key=${key}`);
    if (res.ok) {
      setAuthenticated(true);
      await fetchStats(key);
      addLog("Authenticated successfully");
    } else {
      addLog("Invalid admin key");
    }
  };

  const runImport = async (queries?: string[]) => {
    setLoading("import");
    addLog(`Starting import${queries ? ` (${queries.length} custom queries)` : " (all Indian products)"}...`);

    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify(queries ? { queries, page_size: 50, max_pages: 2 } : { page_size: 50, max_pages: 2 }),
      });

      const data: ImportResult = await res.json();
      addLog(`Import done: ${data.imported} imported, ${data.skipped} skipped, ${data.failed} failed`);
      if (data.errors.length > 0) {
        data.errors.forEach((e) => addLog(`  Error: ${e}`));
      }
      await fetchStats(key);
    } catch (err) {
      addLog(`Import error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  const runAnalysis = async (batchSize = 5) => {
    setLoading("analyze");
    addLog(`Analyzing batch of ${batchSize} products...`);

    try {
      const res = await fetch("/api/admin/analyze-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ batch_size: batchSize }),
      });

      const data: AnalyzeResult = await res.json();
      addLog(`Analysis done: ${data.analyzed} analyzed, ${data.failed} failed`);
      data.results.forEach((r) => addLog(`  ${r.name}: ${r.score}/100 (${r.grade})`));
      if (data.errors.length > 0) {
        data.errors.forEach((e) => addLog(`  Error: ${e}`));
      }
      await fetchStats(key);
    } catch (err) {
      addLog(`Analysis error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(null);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-dvh bg-oasis-black flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-white text-center">Oasis Admin</h1>
          <p className="text-oasis-muted text-center text-sm">Enter your admin key to continue</p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="Admin secret key"
            className="w-full px-4 py-3 bg-oasis-card border border-oasis-border rounded-xl text-white placeholder:text-oasis-muted focus:outline-none focus:border-oasis-green"
          />
          <button
            onClick={handleAuth}
            className="w-full py-3 bg-oasis-green text-oasis-black font-semibold rounded-xl hover:brightness-110 transition"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-oasis-black p-4 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-white">Oasis Admin — Product Pipeline</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Products", value: stats.total, color: "text-white" },
            { label: "Analyzed", value: stats.analyzed, color: "text-emerald-400" },
            { label: "Has Ingredients", value: stats.with_ingredients, color: "text-blue-400" },
            { label: "Needs Analysis", value: stats.unanalyzed, color: "text-amber-400" },
          ].map((s) => (
            <div key={s.label} className="bg-oasis-card border border-oasis-border rounded-xl p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
              <div className="text-xs text-oasis-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Grade Distribution */}
      {stats && Object.keys(stats.by_grade).length > 0 && (
        <div className="bg-oasis-card border border-oasis-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-oasis-muted mb-3">Score Distribution</h2>
          <div className="flex gap-2">
            {["A", "B", "C", "D", "E"].map((grade) => {
              const count = stats.by_grade[grade] || 0;
              const pct = stats.analyzed ? Math.round((count / stats.analyzed) * 100) : 0;
              const colors: Record<string, string> = {
                A: "bg-emerald-500", B: "bg-lime-500", C: "bg-amber-500", D: "bg-orange-500", E: "bg-red-500",
              };
              return (
                <div key={grade} className="flex-1 text-center">
                  <div className="text-xs text-oasis-muted mb-1">{grade}</div>
                  <div className="h-20 bg-oasis-black/50 rounded-lg flex items-end overflow-hidden">
                    <div className={`w-full ${colors[grade]} rounded-t-md transition-all`} style={{ height: `${Math.max(pct, 4)}%` }} />
                  </div>
                  <div className="text-xs text-white mt-1">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category & Source Breakdown */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-oasis-card border border-oasis-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-oasis-muted mb-2">By Category</h2>
            <div className="space-y-1">
              {Object.entries(stats.by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => (
                  <div key={cat} className="flex justify-between text-sm">
                    <span className="text-white capitalize">{cat.replace("_", " ")}</span>
                    <span className="text-oasis-muted">{count}</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="bg-oasis-card border border-oasis-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-oasis-muted mb-2">By Source</h2>
            <div className="space-y-1">
              {Object.entries(stats.by_source)
                .sort(([, a], [, b]) => b - a)
                .map(([src, count]) => (
                  <div key={src} className="flex justify-between text-sm">
                    <span className="text-white capitalize">{src}</span>
                    <span className="text-oasis-muted">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-oasis-muted">Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => runImport()}
            disabled={!!loading}
            className="py-3 px-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            {loading === "import" ? "Importing..." : "Import All Indian Products from OFF"}
          </button>
          <button
            onClick={() => runImport(["maggi", "parle", "amul", "britannia", "haldiram", "kurkure", "bournvita", "tata", "dabur", "patanjali"])}
            disabled={!!loading}
            className="py-3 px-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            {loading === "import" ? "Importing..." : "Quick Import — Top 10 Brands"}
          </button>
          <button
            onClick={() => runAnalysis(5)}
            disabled={!!loading}
            className="py-3 px-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            {loading === "analyze" ? "Analyzing..." : "Analyze 5 Products (Gemini)"}
          </button>
          <button
            onClick={() => runAnalysis(15)}
            disabled={!!loading}
            className="py-3 px-4 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
          >
            {loading === "analyze" ? "Analyzing..." : "Analyze 15 Products (Gemini)"}
          </button>
        </div>
        <p className="text-xs text-oasis-muted">
          Import pulls from Open Food Facts (free, no AI cost). Analysis uses Gemini 2.5 Flash (20 free req/day on free tier).
        </p>
      </div>

      {/* Log */}
      <div className="bg-oasis-card border border-oasis-border rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold text-oasis-muted">Activity Log</h2>
          <button onClick={() => setLog([])} className="text-xs text-oasis-muted hover:text-white transition">
            Clear
          </button>
        </div>
        <div className="space-y-1 max-h-60 overflow-y-auto font-mono text-xs">
          {log.length === 0 ? (
            <p className="text-oasis-muted">No activity yet</p>
          ) : (
            log.map((entry, i) => (
              <div key={i} className="text-oasis-muted">
                {entry}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
