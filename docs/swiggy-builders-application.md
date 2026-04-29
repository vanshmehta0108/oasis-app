# Swiggy Builders Club — Application

**Submit at:** https://mcp.swiggy.com/builders/
**Contact:** builders@swiggy.in

---

## Your Details

- **Name:** Vansh Mehta
- **Email:** vanshmehta0108@gmail.com
- **App name:** Sift
- **Website:** https://sift-india.vercel.app
- **GitHub:** https://github.com/vanshmehta0108/oasis-app

---

## Application Text

### What are you building?

Sift is an AI-powered food safety scanner built specifically for Indian consumers. Users scan a product barcode or photograph the ingredient label — Sift analyses the ingredients against FSSAI regulations, WHO/ICMR thresholds, and Indian dietary context (diabetes prevalence, lactose intolerance, heart disease risk), then returns a safety score from 0–100 with a detailed per-ingredient breakdown.

We currently have 143,000+ Indian packaged products in our database, ~10,000 of which have been fully scored by our Gemini-powered analysis pipeline. Categories covered: food, beverages, snacks, dairy, baby food, skincare, haircare, household.

### What Swiggy APIs do you need and why?

We want to integrate three capabilities from the Instamart API:

**1. Product catalog enrichment**
Many products in our DB are missing ingredient text — they were imported from barcode registries that only carry the product name and brand. The Instamart catalog has ingredient text and nutritional info for thousands of these products. Connecting to the Swiggy API lets us fill those gaps and score more products, making Sift genuinely useful for the products people actually buy on Instamart.

**2. Live price display on product and compare pages**
After Sift scores two products, the natural next question is "which one should I buy?" We want to show a live Instamart price alongside each safety score — so the user sees not just "Product A is safer" but "Product A is safer AND ₹20 cheaper on Instamart." This drives directly to an order.

**3. "Order on Instamart" deep link + affiliate integration**
Every product page in Sift already has a "Buy Online" section with Blinkit, Zepto, Amazon Fresh, and BigBasket links. Adding Swiggy Instamart with a live price badge would make it the primary CTA — because it's the only platform showing the user a real price at that moment.

### What is the user journey?

1. User scans a barcode of, say, a Maggi noodles packet at a store.
2. Sift shows the safety score (62/B — "moderate concern"), explains the high sodium and palm oil content.
3. Below the score: "Buy safer alternatives on Instamart" — Sift surfaces 2–3 similar products with higher scores AND lower prices, all linkable directly to Instamart.
4. User taps → lands in Instamart with the product pre-selected → order placed.

This is the core loop: **scan → understand → buy safer**. Swiggy Instamart is the commerce layer that completes it.

### Scale and traction

- 143,000+ products indexed
- Scoring pipeline running continuously (Gemini 2.0 Flash, ~₹990/month AI cost)
- Live at sift-india.vercel.app — working PWA, mobile-optimised
- Built for the Indian market: FSSAI compliance, Hindi i18n, Indian dietary context in every analysis

### Why Swiggy specifically?

Swiggy Instamart has the deepest Indian grocery catalog and the fastest delivery in metro cities — the exact overlap with where Sift's users shop. We're not building a competitor; we're building a discovery and trust layer on top of Instamart. Every high-scoring product recommendation Sift makes is a potential Instamart order.

### What will you build if approved?

- Live price badge on every product page (fetched from Instamart API, cached 5 min)
- "Safer alternatives on Instamart" section — 3 higher-scoring products in the same category, with prices, all orderable in one tap
- Bulk ingredient enrichment: run the Instamart catalog against our 130k+ unscored products to fill ingredient gaps and score them
- Compare page: side-by-side price comparison from Instamart for any two products

---

## Technical Details (for Swiggy's review team)

- **Stack:** Next.js 16, Vercel, Supabase (PostgreSQL)
- **API integration plan:** Server-side only — API key stored in Vercel environment variables, never exposed to the client. All Swiggy calls proxied through `/api/swiggy` route.
- **Rate limiting:** Token-bucket rate limiter on our API route (30 req/min per IP). Instamart price responses cached for 5 minutes on Vercel CDN.
- **Data usage:** We will store Swiggy product prices in our DB only as a cached value with TTL. We will not re-distribute Swiggy catalog data or use it for any purpose other than enriching our ingredient database and showing prices to Sift users.
- **Security:** HTTPS everywhere, no PII stored, Supabase RLS enabled on all tables.

---

*Questions? Reply to vanshmehta0108@gmail.com*
