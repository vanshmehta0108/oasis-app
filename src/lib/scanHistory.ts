export interface ScanRecord {
  id: string;
  name: string;
  brand: string;
  score: number | null;
  grade: string | null;
  category: string;
  timestamp: number;
}

export function recordScan(product: { id: string; name: string; brand: string; safety_score?: number | null; grade?: string | null; category?: string }) {
  const history: ScanRecord[] = JSON.parse(localStorage.getItem("oasis-scan-history") || "[]");

  // Deduplicate — remove existing entry for same product
  const filtered = history.filter(h => h.id !== product.id);

  // Add to front
  filtered.unshift({
    id: product.id,
    name: product.name,
    brand: product.brand,
    score: product.safety_score ?? null,
    grade: product.grade ?? null,
    category: product.category || "Food",
    timestamp: Date.now(),
  });

  // Keep last 50
  const trimmed = filtered.slice(0, 50);
  localStorage.setItem("oasis-scan-history", JSON.stringify(trimmed));

  // Increment scan count
  const count = parseInt(localStorage.getItem("oasis-scan-count") || "0", 10);
  localStorage.setItem("oasis-scan-count", String(count + 1));
}

export function getScanHistory(): ScanRecord[] {
  return JSON.parse(localStorage.getItem("oasis-scan-history") || "[]");
}

export function getScanCount(): number {
  return parseInt(localStorage.getItem("oasis-scan-count") || "0", 10);
}
