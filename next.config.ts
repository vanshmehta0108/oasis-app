import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
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
