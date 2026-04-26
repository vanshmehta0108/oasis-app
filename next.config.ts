import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Open Food Facts product images
      { protocol: "https", hostname: "**.openfoodfacts.org" },
      { protocol: "https", hostname: "**.openfoodfacts.net" },
      // Google profile pictures (OAuth)
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
      // BigBasket product images
      { protocol: "https", hostname: "**.bigbasket.com" },
      // Catch-all for other product image sources (OFF, Flipkart, etc.)
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: "sift-0a",
  project: "javascript-nextjs",

  // Only upload source maps when SENTRY_AUTH_TOKEN is set (CI/CD)
  silent: !process.env.CI,

  // Upload source maps for better stack traces in Sentry
  widenClientFileUpload: true,

  // Route browser requests to avoid ad-blockers
  tunnelRoute: "/monitoring",

  // Hide source maps from generated client bundles
  sourcemaps: { disable: false },
});
