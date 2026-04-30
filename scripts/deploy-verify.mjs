#!/usr/bin/env node
/**
 * One-shot production deploy verifier.
 *
 * Runs the same smoke checks the verification agent runs, but locally
 * with a clear pass/fail summary. Use after every deploy.
 *
 * Usage:
 *   node scripts/deploy-verify.mjs                        # checks production
 *   node scripts/deploy-verify.mjs https://other-url.com  # checks any URL
 *
 * Exit code 0 on full pass, 1 on any failure.
 */

const BASE = process.argv[2]?.replace(/\/$/, "") || "https://sift-india.vercel.app";

let pass = 0;
let fail = 0;
const failures = [];

async function check(name, fn) {
  try {
    const result = await fn();
    if (result === true) {
      console.log(`  ✓  ${name}`);
      pass++;
    } else {
      console.log(`  ✗  ${name} — ${result}`);
      failures.push(`${name}: ${result}`);
      fail++;
    }
  } catch (err) {
    console.log(`  ✗  ${name} — threw ${err?.message || err}`);
    failures.push(`${name}: ${err?.message || err}`);
    fail++;
  }
}

async function main() {
  console.log(`\nVerifying ${BASE}\n`);

  await check("/privacy returns 200 (proof of new deploy)", async () => {
    const r = await fetch(`${BASE}/privacy`);
    return r.status === 200 || `got ${r.status}`;
  });

  await check("/api/personalize new payload shape", async () => {
    const r = await fetch(`${BASE}/api/personalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({
        ingredients: ["Maida", "Sugar", "Refined Palm Oil", "Salt"],
        conditions: ["Diabetic", "Heart Condition"],
        allergies: [],
      }),
    });
    if (r.status !== 200) return `got ${r.status}`;
    const body = await r.json();
    const required = ["warnings", "penalty", "deterministicCount", "llmCount", "llmCalled", "cached"];
    const missing = required.filter((k) => !(k in body));
    if (missing.length) return `missing fields: ${missing.join(", ")}`;
    if (body.penalty <= 0) return `expected penalty > 0, got ${body.penalty}`;
    if (body.deterministicCount < 2) return `expected deterministicCount >= 2, got ${body.deterministicCount}`;
    return true;
  });

  await check("/api/personalize empty profile fast path", async () => {
    const r = await fetch(`${BASE}/api/personalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({ ingredients: ["Sugar"], conditions: [], allergies: [] }),
    });
    if (r.status !== 200) return `got ${r.status}`;
    const body = await r.json();
    if (body.llmCalled) return `expected llmCalled: false, got true`;
    if (body.penalty !== 0) return `expected penalty: 0, got ${body.penalty}`;
    return true;
  });

  await check("CORS: evil.com origin gets no ACAO", async () => {
    const r = await fetch(`${BASE}/api/personalize`, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.com", "Access-Control-Request-Method": "POST" },
    });
    const aco = r.headers.get("access-control-allow-origin");
    return !aco || `got ACAO: ${aco}`;
  });

  await check("CORS: sift origin echoed", async () => {
    const r = await fetch(`${BASE}/api/personalize`, {
      method: "OPTIONS",
      headers: { Origin: BASE, "Access-Control-Request-Method": "POST" },
    });
    const aco = r.headers.get("access-control-allow-origin");
    return aco === BASE || `expected ${BASE}, got ${aco}`;
  });

  await check("/api/admin/stats?key=anything returns 401", async () => {
    const r = await fetch(`${BASE}/api/admin/stats?key=anything`);
    return r.status === 401 || `got ${r.status}`;
  });

  await check("/api/account/delete (no token) returns 401", async () => {
    const r = await fetch(`${BASE}/api/account/delete`, { method: "POST" });
    return r.status === 401 || `got ${r.status}`;
  });

  await check("/api/personalize rejects oversize body (>64KB)", async () => {
    // Build a body just over the 64KB cap: 200 ingredients × 400 chars ≈ 80KB.
    const huge = Array.from({ length: 200 }, () => "x".repeat(400));
    const r = await fetch(`${BASE}/api/personalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify({ ingredients: huge, conditions: ["Diabetic"], allergies: [] }),
    });
    if (r.status === 400 || r.status === 413) return true;
    return `expected 400 or 413, got ${r.status}`;
  });

  console.log(`\n──────────────────────────────────────────────────`);
  console.log(`  ${pass} passed   ${fail} failed`);
  console.log(`──────────────────────────────────────────────────`);
  if (fail > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("\nDeploy looks healthy.\n");
}

main().catch((err) => {
  console.error("Verifier crashed:", err);
  process.exit(1);
});
