// Shared CORS policy for /api/* routes.
//
// Previously every route returned `Access-Control-Allow-Origin: *`, which let
// any third-party site call our endpoints from a browser and burn AI quota /
// scrape product data. We now reflect the request's Origin header back if and
// only if it's in the allowlist below; everything else gets no
// Access-Control-Allow-Origin header (browser will block the response).
//
// Rules:
//   - Same-origin requests carry no Origin header in many cases — return no
//     CORS header (browser doesn't need it).
//   - Server-to-server requests (mobile apps, scripts) carry no Origin and
//     work fine without CORS headers.
//   - Browser cross-origin requests must come from a known frontend.

const STATIC_ALLOWLIST: readonly string[] = [
  "https://sift-india.vercel.app",
  "https://sift-in.vercel.app",
  "https://trysift.vercel.app",
  "https://usesift.vercel.app",
  "https://siftapp-in.vercel.app",
  "https://sift-health.vercel.app",
  // Local dev
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  // Capacitor / native shells
  "capacitor://localhost",
  "ionic://localhost",
];

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWLIST.includes(origin)) return true;
  // Allow any *.vercel.app subdomain that includes "sift" in the host —
  // catches preview URLs (e.g. sift-india-git-feature-branch-foo.vercel.app)
  // without opening the door to arbitrary attacker-controlled vercel.app
  // sites.
  try {
    const u = new URL(origin);
    // Allow only Vercel preview deployments that follow our official subdomain
    // pattern: `<project>-<hash>-<team>.vercel.app` or `<project>-git-<branch>-<team>.vercel.app`
    // where <project> begins with one of the known Sift projects. The previous
    // `/sift/i.test()` check accepted any hostname containing "sift",
    // including attacker-controlled subdomains like
    // `attacker-sift-impersonator.vercel.app`.
    if (
      u.protocol === "https:" &&
      /^(sift|trysift|usesift|siftapp)(-in|-india|-app|-health)?(-[a-z0-9]+)*\.vercel\.app$/i.test(u.hostname)
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export interface CorsOptions {
  methods?: readonly string[];                // default: ["POST", "OPTIONS"]
  allowedHeaders?: readonly string[];          // default: ["Content-Type"]
  allowCredentials?: boolean;                  // default: false
  maxAgeSeconds?: number;                      // default: 600
}

// Build CORS headers for a specific request. The request's Origin determines
// whether ACAO is set at all; never return `*`.
export function corsHeadersFor(req: Request, opts: CorsOptions = {}): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  const methods = (opts.methods ?? ["POST", "OPTIONS"]).join(", ");
  const allowedHeaders = (opts.allowedHeaders ?? ["Content-Type"]).join(", ");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Max-Age": String(opts.maxAgeSeconds ?? 600),
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    if (opts.allowCredentials) headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

// Standard preflight response.
export function corsPreflight(req: Request, opts: CorsOptions = {}): Response {
  return new Response(null, { status: 204, headers: corsHeadersFor(req, opts) });
}

// Test-only export.
export const __INTERNAL = { isAllowedOrigin, STATIC_ALLOWLIST };
