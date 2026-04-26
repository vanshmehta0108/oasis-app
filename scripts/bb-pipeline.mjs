#!/usr/bin/env node
/**
 * Pipeline that keeps importing new BigBasket scraped products while the
 * scraper is running. Runs bb-import.mjs --resume every INTERVAL_MIN minutes.
 * analyze-all.mjs (running separately) scores the new products automatically.
 *
 * Usage:
 *   node scripts/bb-pipeline.mjs           # import every 10 min
 *   node scripts/bb-pipeline.mjs --interval=5
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSONL = path.join(__dirname, '../data/bigbasket-products.jsonl');
const INTERVAL_ARG = process.argv.find(a => a.startsWith('--interval='));
const INTERVAL_MIN = parseInt(INTERVAL_ARG?.split('=')[1] ?? '10');

console.log(`BigBasket pipeline — importing every ${INTERVAL_MIN} min\n`);

async function runImport() {
  if (!existsSync(JSONL)) {
    console.log('No JSONL file yet, waiting...');
    return;
  }
  console.log(`[${new Date().toLocaleTimeString()}] Running bb-import --resume...`);
  try {
    execSync('node scripts/bb-import.mjs --resume', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });
  } catch (e) {
    console.error('Import error:', e.message?.slice(0, 100));
  }
}

while (true) {
  await runImport();
  console.log(`\n⏳ Next import in ${INTERVAL_MIN} min...\n`);
  await new Promise(r => setTimeout(r, INTERVAL_MIN * 60_000));
}
