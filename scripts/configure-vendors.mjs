#!/usr/bin/env node
/**
 * One-paste vendor activation.
 *
 * Once you've signed up for Upstash Redis and/or hCaptcha, paste your
 * keys here and this script writes them to Vercel env (production +
 * development) and triggers a redeploy. Idempotent — re-running with
 * the same values is a no-op.
 *
 * Usage:
 *   node scripts/configure-vendors.mjs upstash <REST_URL> <REST_TOKEN>
 *   node scripts/configure-vendors.mjs hcaptcha <SECRET> <SITEKEY>
 *   node scripts/configure-vendors.mjs status
 *
 * Requires:
 *   - vercel CLI authenticated (run `vercel whoami` to check)
 *   - run from repo root
 *
 * Why this exists:
 *   Each vendor has a 30-second sign-up flow that ends with you copying
 *   two strings. Instead of pasting them into the Vercel dashboard
 *   manually (and missing one of production/development), this script
 *   syncs everything in one shot.
 */

import { spawnSync } from "node:child_process";

function vercel(args, opts = {}) {
  const r = spawnSync("vercel", args, { encoding: "utf8", ...opts });
  return { code: r.status ?? 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function vercelEnvSet(name, value, env) {
  // Remove any existing value first to avoid the CLI's interactive prompt.
  const rm = vercel(["env", "rm", name, env, "--yes"]);
  if (rm.code !== 0 && !/not found/i.test(rm.err + rm.out)) {
    console.warn(`  warn: rm ${name}/${env}: ${rm.err.trim() || rm.out.trim()}`);
  }
  const add = vercel(["env", "add", name, env, "--value", value, "--yes"]);
  if (add.code !== 0) {
    console.error(`  fail: add ${name}/${env}: ${add.err.trim() || add.out.trim()}`);
    return false;
  }
  return true;
}

function setSecret(name, value, { isPublic = false } = {}) {
  const envs = ["production", "development"];
  let ok = true;
  for (const env of envs) {
    process.stdout.write(`  ${env}/${name}…`);
    const success = vercelEnvSet(name, value, env);
    process.stdout.write(success ? " ok\n" : " FAILED\n");
    ok = ok && success;
  }
  if (isPublic) {
    console.log(`  (NEXT_PUBLIC_ var — exposed to the client bundle by design)`);
  }
  return ok;
}

function redeploy() {
  console.log("\nFetching latest production deployment to redeploy…");
  const ls = vercel(["ls", "--prod"]);
  // Find the first deployment URL in the output.
  const url = ls.out.match(/https:\/\/sift-[a-z0-9-]+\.vercel\.app/);
  if (!url) {
    console.error("Couldn't find a recent production deployment. Run `vercel ls --prod` and redeploy manually.");
    return false;
  }
  console.log(`Redeploying ${url[0]}…`);
  const r = vercel(["redeploy", url[0]]);
  if (r.code !== 0) {
    console.error(`Redeploy failed: ${r.err.trim() || r.out.trim()}`);
    return false;
  }
  console.log("Redeploy started — Vercel build in progress.");
  return true;
}

function status() {
  const ls = vercel(["env", "ls"]);
  const lines = ls.out.split("\n");
  const wanted = [
    "ADMIN_SECRET",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "HCAPTCHA_SECRET",
    "NEXT_PUBLIC_HCAPTCHA_SITEKEY",
  ];
  console.log("\nVendor configuration status:\n");
  for (const name of wanted) {
    const present = lines.filter((l) => l.includes(name) && l.includes("Encrypted"));
    if (present.length === 0) {
      console.log(`  ✗  ${name.padEnd(32)} not set`);
    } else {
      const envs = present.map((l) => {
        const m = l.match(/Production|Preview|Development/);
        return m ? m[0] : "?";
      });
      console.log(`  ✓  ${name.padEnd(32)} ${[...new Set(envs)].join(", ")}`);
    }
  }
  console.log("");
}

function help() {
  console.log(`
Sift vendor configuration

  node scripts/configure-vendors.mjs status
  node scripts/configure-vendors.mjs upstash <REST_URL> <REST_TOKEN>
  node scripts/configure-vendors.mjs hcaptcha <SECRET> <SITEKEY>

After setting keys, the script triggers a Vercel redeploy automatically.

Sign-up links:
  Upstash:  https://upstash.com/   (create Redis db → copy REST URL + token)
  hCaptcha: https://www.hcaptcha.com/   (create site → copy Sitekey + Secret)
`);
}

const [, , cmd, a, b] = process.argv;

if (cmd === "status") {
  status();
} else if (cmd === "upstash") {
  if (!a || !b) { help(); process.exit(1); }
  console.log("\nWriting Upstash keys to Vercel:");
  const ok = [
    setSecret("UPSTASH_REDIS_REST_URL", a),
    setSecret("UPSTASH_REDIS_REST_TOKEN", b),
  ].every(Boolean);
  if (ok) redeploy();
} else if (cmd === "hcaptcha") {
  if (!a || !b) { help(); process.exit(1); }
  console.log("\nWriting hCaptcha keys to Vercel:");
  const ok = [
    setSecret("HCAPTCHA_SECRET", a),
    setSecret("NEXT_PUBLIC_HCAPTCHA_SITEKEY", b, { isPublic: true }),
  ].every(Boolean);
  if (ok) redeploy();
} else {
  help();
  process.exit(cmd ? 1 : 0);
}
