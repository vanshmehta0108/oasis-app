// Playwright config for Sift E2E.
//
// Setup (one-time):
//   npm install -D @playwright/test
//   npx playwright install chromium
//
// Run:
//   npm run e2e          — local dev server + Chromium headless
//   npm run e2e:ui       — Playwright UI mode for debugging
//   npm run e2e:prod     — point at production URL instead of localhost
//
// CI:
//   Add a GitHub Actions step that runs `npm run e2e` on every PR.
//   See docs/E2E.md (TODO) for the workflow file.

import { defineConfig, devices } from "@playwright/test";

const BASE_URL =
  process.env.E2E_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  // Each test must complete in 30 s (analyze can take 8 s + headroom).
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Mobile-first app — test on a Pixel-class device by default.
  projects: [
    {
      name: "android-pixel",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "ios-iphone",
      use: { ...devices["iPhone 14"] },
    },
  ],
  // Boot a dev server when running locally; skip when E2E_BASE_URL is set.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      },
});
