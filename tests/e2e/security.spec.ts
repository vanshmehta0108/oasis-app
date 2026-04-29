// Critical path 3: security smoke tests.
//
// Asserts CORS lockdown + admin auth on /api/* endpoints. Without these
// passing, any random web page can call our endpoints from the browser.

import { test, expect } from "@playwright/test";

test.describe("CORS lockdown", () => {
  test("disallowed origin gets no Access-Control-Allow-Origin", async ({ request }) => {
    const res = await request.fetch("/api/personalize", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.com", "Access-Control-Request-Method": "POST" },
    });
    // Server returns the preflight, but ACAO must NOT be present (browsers
    // will then block the response).
    const aco = res.headers()["access-control-allow-origin"];
    expect(aco).toBeFalsy();
  });

  test("allowlisted origin echoes ACAO", async ({ request }) => {
    const res = await request.fetch("/api/personalize", {
      method: "OPTIONS",
      headers: {
        Origin: "https://sift-india.vercel.app",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.headers()["access-control-allow-origin"]).toBe("https://sift-india.vercel.app");
  });
});

test.describe("Admin endpoints", () => {
  test("/api/admin/stats without key returns 401", async ({ request }) => {
    const res = await request.get("/api/admin/stats");
    expect(res.status()).toBe(401);
  });

  test("/api/admin/products without key returns 401", async ({ request }) => {
    const res = await request.get("/api/admin/products");
    expect(res.status()).toBe(401);
  });

  test("admin key in querystring is rejected (header-only)", async ({ request }) => {
    const res = await request.get("/api/admin/stats?key=anything");
    expect(res.status()).toBe(401);
  });
});

test.describe("Privacy", () => {
  test("/privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1")).toContainText(/privacy/i);
  });

  test("delete-account requires auth", async ({ request }) => {
    const res = await request.post("/api/account/delete");
    // 401 (no token) or 429 (rate-limited locally) — never 200.
    expect([401, 429]).toContain(res.status());
  });
});
