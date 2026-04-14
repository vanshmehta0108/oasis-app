// ── Brave Search API client ────────────────────────────────────────────────────
//
// Used as a fallback when Open Food Facts doesn't have a product.
// Searches for product ingredients, brand info, and nutritional data.

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  extra_snippets?: string[];
}

export interface BraveSearchResponse {
  query: string;
  results: BraveSearchResult[];
  raw_text: string; // combined text for AI extraction
}

function getBraveApiKey(): string | null {
  return process.env.BRAVE_SEARCH_API_KEY || null;
}

/**
 * Search Brave for product information.
 * Returns top results with their text content for AI extraction.
 */
export async function searchBrave(
  query: string,
  count = 5
): Promise<BraveSearchResponse | null> {
  const apiKey = getBraveApiKey();
  if (!apiKey) {
    console.warn("BRAVE_SEARCH_API_KEY not set — Brave search disabled");
    return null;
  }

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&country=IN&search_lang=en&text_decorations=false`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`Brave search failed: ${res.status} ${res.statusText}`, errorText);
      return null;
    }

    const data = await res.json();
    const webResults = data.web?.results || [];

    const results: BraveSearchResult[] = webResults.map(
      (r: { title: string; url: string; description: string; extra_snippets?: string[] }) => ({
        title: r.title || "",
        url: r.url || "",
        description: r.description || "",
        extra_snippets: r.extra_snippets || [],
      })
    );

    // Combine all text for AI extraction
    const raw_text = results
      .map((r) => {
        const snippets = r.extra_snippets?.join(" ") || "";
        return `${r.title}\n${r.description}\n${snippets}`;
      })
      .join("\n\n---\n\n");

    return { query, results, raw_text };
  } catch (error) {
    console.error("Brave search error:", error);
    return null;
  }
}

/**
 * Search for a product by barcode number.
 * Tries multiple search strategies to maximize hit rate.
 */
export async function searchProductByBarcode(
  barcode: string
): Promise<BraveSearchResponse | null> {
  // Try barcode-specific search first
  const result = await searchBrave(
    `"${barcode}" product ingredients India`,
    5
  );

  if (result && result.results.length > 0) return result;

  // Fallback: just the barcode number
  return searchBrave(`barcode ${barcode} food product`, 5);
}

/**
 * Search for a product by name to find ingredients and details.
 */
export async function searchProductByName(
  name: string,
  brand?: string
): Promise<BraveSearchResponse | null> {
  const query = brand
    ? `"${brand}" "${name}" ingredients list India`
    : `"${name}" ingredients list nutritional information India`;

  return searchBrave(query, 8);
}

/**
 * Search for product rankings and comparisons.
 */
export async function searchProductComparison(
  category: string,
  productNames: string[]
): Promise<BraveSearchResponse | null> {
  const names = productNames.slice(0, 5).join(" vs ");
  return searchBrave(
    `${names} ${category} healthiest comparison ingredients India`,
    8
  );
}
