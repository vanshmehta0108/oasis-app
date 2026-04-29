// Critical path 2: /api/personalize endpoint contract.
//
// Verifies the new payload shape (from the deterministic-matcher work) is
// returned by the live API. This is the smoke test we'd run on every deploy.

import { test, expect } from "@playwright/test";

test.describe("/api/personalize contract", () => {
  test("returns deterministic matches + penalty + cache fields", async ({ request }) => {
    const res = await request.post("/api/personalize", {
      data: {
        ingredients: ["Maida", "Sugar", "Refined Palm Oil", "Salt"],
        conditions: ["Diabetic", "Heart Condition"],
        allergies: [],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("warnings");
    expect(body).toHaveProperty("penalty");
    expect(body).toHaveProperty("deterministicCount");
    expect(body).toHaveProperty("llmCount");
    expect(body).toHaveProperty("llmCalled");
    expect(body).toHaveProperty("cached");
    expect(Array.isArray(body.warnings)).toBe(true);
    expect(typeof body.penalty).toBe("number");
    expect(body.penalty).toBeGreaterThan(0);
    expect(body.deterministicCount).toBeGreaterThanOrEqual(2);
  });

  test("empty profile returns the fast path", async ({ request }) => {
    const res = await request.post("/api/personalize", {
      data: {
        ingredients: ["Sugar"],
        conditions: [],
        allergies: [],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.warnings).toEqual([]);
    expect(body.penalty).toBe(0);
    expect(body.llmCalled).toBe(false);
  });

  test("invalid request returns 400", async ({ request }) => {
    const res = await request.post("/api/personalize", {
      data: { ingredients: [] },
    });
    expect(res.status()).toBe(400);
  });

  test("oversized payload is rejected", async ({ request }) => {
    // Build an ingredient list that's 70KB — well over the 64KB body cap.
    const huge = Array.from({ length: 200 }, () => "x".repeat(400));
    const res = await request.post("/api/personalize", {
      data: { ingredients: huge, conditions: ["Diabetic"], allergies: [] },
    });
    // Either 413 (size cap hit) or 400 (zod max-200 ingredients rejected).
    expect([400, 413]).toContain(res.status());
  });
});
