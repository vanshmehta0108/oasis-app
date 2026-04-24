// Client-only store for the "Compare products" list. Kept in
// localStorage so it survives tab reloads. Maximum 3 products — enough
// to be useful, few enough to fit on a phone screen side-by-side.

export interface CompareItem {
  id: string;
  name: string;
  brand: string;
  category: string;
  safety_score: number | null;
  grade: string | null;
  summary?: string;
  addedAt: number;
}

const KEY = "sift-compare-list";
const MAX_ITEMS = 3;

function read(): CompareItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: CompareItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("sift-compare-changed"));
  } catch {}
}

export function getCompareList(): CompareItem[] {
  return read();
}

export function isInCompare(id: string): boolean {
  return read().some((i) => i.id === id);
}

// Returns true if the item was added, false if it was already present
// or the list was full. Caller decides what to tell the user.
export function addToCompare(item: Omit<CompareItem, "addedAt">): "added" | "already" | "full" {
  const items = read();
  if (items.some((i) => i.id === item.id)) return "already";
  if (items.length >= MAX_ITEMS) return "full";
  write([...items, { ...item, addedAt: Date.now() }]);
  return "added";
}

export function removeFromCompare(id: string): void {
  write(read().filter((i) => i.id !== id));
}

export function clearCompare(): void {
  write([]);
}

export const COMPARE_MAX = MAX_ITEMS;
