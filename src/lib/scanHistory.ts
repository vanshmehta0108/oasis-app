export interface ScanRecord {
  id: string;
  name: string;
  brand: string;
  score: number | null;
  grade: string | null;
  category: string;
  timestamp: number;
}

const HISTORY_KEY = "oasis-scan-history";
const COUNT_KEY = "oasis-scan-count";

function safeParseHistory(): ScanRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt storage — reset so we don't crash every page that reads it
    try { localStorage.removeItem(HISTORY_KEY); } catch {}
    return [];
  }
}

export function recordScan(product: { id: string; name: string; brand: string; safety_score?: number | null; grade?: string | null; category?: string }) {
  if (typeof window === "undefined") return;
  const history = safeParseHistory();

  // Deduplicate — remove existing entry for same product
  const filtered = history.filter(h => h.id !== product.id);

  filtered.unshift({
    id: product.id,
    name: product.name,
    brand: product.brand,
    score: product.safety_score ?? null,
    grade: product.grade ?? null,
    category: product.category || "Food",
    timestamp: Date.now(),
  });

  const trimmed = filtered.slice(0, 50);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded or storage disabled — drop silently rather than crash the caller
  }

  try {
    const count = parseInt(localStorage.getItem(COUNT_KEY) || "0", 10);
    localStorage.setItem(COUNT_KEY, String((Number.isFinite(count) ? count : 0) + 1));
  } catch {}
}

export function getScanHistory(): ScanRecord[] {
  return safeParseHistory();
}

export function getScanCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = parseInt(localStorage.getItem(COUNT_KEY) || "0", 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
