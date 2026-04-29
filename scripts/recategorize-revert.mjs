#!/usr/bin/env node
/**
 * Revert a recategorize --apply run using its snapshot file.
 *
 * Usage:
 *   node scripts/recategorize-revert.mjs scripts/.recategorize-snapshot-skincare-1714521200000.json
 *
 * Reads each entry and writes products.category back to the recorded `from`.
 * Idempotent — safe to run twice.
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const snapshotFile = process.argv[2];
if (!snapshotFile) {
  console.error("Usage: node scripts/recategorize-revert.mjs <snapshot.json>");
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf-8"));
console.log(`Reverting ${snapshot.length} products from snapshot...`);

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let ok = 0;
let fail = 0;
for (const entry of snapshot) {
  const { error } = await sb
    .from("products")
    .update({ category: entry.from })
    .eq("id", entry.id);
  if (error) {
    console.log(`  ✗ ${entry.name}: ${error.message}`);
    fail++;
  } else {
    ok++;
  }
}

console.log("");
console.log(`Reverted: ${ok} | Failed: ${fail}`);
