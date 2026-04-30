import type { MetadataRoute } from "next";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sift-india.vercel.app").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Block routes that should never appear in search results.
        // /api is implicitly handled by Next, but listing it makes the intent
        // explicit for crawlers that index Vercel preview URLs.
        disallow: ["/api/", "/admin", "/auth/", "/share/inbox", "/monitoring"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
