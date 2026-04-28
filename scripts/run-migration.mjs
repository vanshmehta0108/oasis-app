/**
 * One-shot migration runner.
 * Usage: node scripts/run-migration.mjs
 *
 * Uses the Supabase Management API to execute the SQL migration.
 * Requires SUPABASE_ACCESS_TOKEN env var (get from https://supabase.com/dashboard/account/tokens).
 *
 * Or set DB_URL directly:
 *   DB_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres node scripts/run-migration.mjs
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = "wcdtiyrdmhsxkxtxlgsr";
const MIGRATION_FILE = join(__dirname, "../supabase/migrations/002_extended_user_profiles.sql");
const sql = readFileSync(MIGRATION_FILE, "utf-8");

const token = process.env.SUPABASE_ACCESS_TOKEN;
const dbUrl = process.env.DB_URL;

if (!token && !dbUrl) {
  console.error("\n❌ Missing credentials.\n");
  console.error("Option A — Supabase Management API token:");
  console.error("  1. Go to https://supabase.com/dashboard/account/tokens");
  console.error("  2. Create a token and run:");
  console.error("     SUPABASE_ACCESS_TOKEN=your-token node scripts/run-migration.mjs\n");
  console.error("Option B — Direct DB URL:");
  console.error("  1. Go to Supabase Dashboard → Settings → Database → Connection string");
  console.error("  2. Copy the URI and run:");
  console.error("     DB_URL='postgresql://postgres:password@...' node scripts/run-migration.mjs\n");
  console.error("Option C — Paste in Supabase SQL Editor:");
  console.error(`  Open https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
  console.error("  and paste the contents of supabase/migrations/002_extended_user_profiles.sql\n");
  process.exit(1);
}

if (dbUrl) {
  // Direct pg connection
  const { default: pg } = await import("pg").catch(() => { throw new Error("Run: npm install pg"); });
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✓ Connected to database");
  await client.query(sql);
  console.log("✓ Migration applied successfully");
  await client.end();
} else {
  // Supabase Management API
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("❌ Migration failed:", JSON.stringify(body, null, 2));
    process.exit(1);
  }
  console.log("✓ Migration applied successfully:", body);
}
