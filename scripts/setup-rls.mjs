#!/usr/bin/env node
/**
 * Walk the user through running docs/cloud-rls-hardening.sql in Supabase.
 *
 * Why a script and not just "go run the SQL":
 *   - Opens the right Supabase SQL editor URL automatically.
 *   - Copies the SQL to the clipboard so it's a one-paste-and-run.
 *   - Prints a verification query you can paste afterwards to confirm
 *     RLS is on.
 *
 * Run: node scripts/setup-rls.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const SQL_PATH = resolve("docs/cloud-rls-hardening.sql");
const PROJECT_REF = "wcdtiyrdmhsxkxtxlgsr"; // from supabase URL
const SQL_EDITOR_URL = `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`;

let sql;
try {
  sql = readFileSync(SQL_PATH, "utf8");
} catch (err) {
  console.error(`Could not read ${SQL_PATH}: ${err.message}`);
  process.exit(1);
}

const VERIFY_QUERY = `-- Confirm RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('user_profiles', 'products', 'community_submissions');`;

function copyToClipboard(text) {
  // pbcopy is macOS-only; we're on darwin per the project context.
  const r = spawnSync("pbcopy", [], { input: text });
  return r.status === 0;
}

function openInBrowser(url) {
  // Detached so we don't block on the browser.
  const r = spawn("open", [url], { detached: true, stdio: "ignore" });
  r.unref();
}

console.log(`
──────────────────────────────────────────────────
  Sift RLS migration setup
──────────────────────────────────────────────────

This will:
  1. Copy the migration SQL to your clipboard.
  2. Open the Supabase SQL editor in your browser.
  3. Wait for you to paste (Cmd+V) and click "Run".

The SQL is idempotent — safe to re-run.
`);

const copied = copyToClipboard(sql);
console.log(copied ? "✓  SQL copied to clipboard." : "✗  Couldn't copy to clipboard. Manually open " + SQL_PATH);

console.log(`✓  Opening ${SQL_EDITOR_URL}`);
openInBrowser(SQL_EDITOR_URL);

console.log(`
Steps in the Supabase tab that just opened:
  1. Cmd+V (paste the migration)
  2. Click "Run" (or Cmd+Enter)
  3. Expected: "Success. No rows returned"

Then run this verification query in the same editor:
${VERIFY_QUERY}

Expected output: 3 rows, all with rowsecurity = true.

When done, run:
  npm run verify     # confirms /api/account/delete now works end-to-end
`);
