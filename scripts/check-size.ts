/**
 * Enforces the performance budget. The app is meant to open instantly on a
 * phone on a weak connection, so bundle growth should be a deliberate choice,
 * not a surprise. Run with `npm run size` (also runs in CI).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

interface Budget {
  label: string;
  bytes: number;
}

const BUDGETS = {
  /** Everything the browser must parse before the first screen paints. */
  appJs: { label: 'app JS (gzipped)', bytes: 100 * 1024 },
  appCss: { label: 'app CSS (gzipped)', bytes: 15 * 1024 },
  /** One parsha of text — the per-reading download. */
  parsha: { label: 'largest parsha (gzipped)', bytes: 60 * 1024 },
  /** Rashi is fetched separately, only when expanded. */
  rashi: { label: 'largest Rashi chunk (gzipped)', bytes: 100 * 1024 },
} as const satisfies Record<string, Budget>;

const gzipOf = (path: string): number => gzipSync(readFileSync(path)).length;

function sumGzip(dir: string, ext: string): number {
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext))
    .reduce((total, f) => total + gzipOf(join(dir, f)), 0);
}

function largestGzip(dir: string): { name: string; bytes: number } {
  let best = { name: '', bytes: 0 };
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const bytes = gzipOf(join(dir, file));
    if (bytes > best.bytes) best = { name: file, bytes };
  }
  return best;
}

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

function main(): void {
  const assets = join(process.cwd(), 'dist/assets');
  try {
    statSync(assets);
  } catch {
    console.error('No dist/assets — run `npm run build` first.');
    process.exit(1);
  }

  const parsha = largestGzip(join(process.cwd(), 'public/data/parsha'));
  const rashi = largestGzip(join(process.cwd(), 'public/data/rashi'));

  const measured = [
    { budget: BUDGETS.appJs, actual: sumGzip(assets, '.js'), detail: '' },
    { budget: BUDGETS.appCss, actual: sumGzip(assets, '.css'), detail: '' },
    { budget: BUDGETS.parsha, actual: parsha.bytes, detail: parsha.name },
    { budget: BUDGETS.rashi, actual: rashi.bytes, detail: rashi.name },
  ];

  let failed = false;
  for (const { budget, actual, detail } of measured) {
    const ok = actual <= budget.bytes;
    if (!ok) failed = true;
    const pct = Math.round((actual / budget.bytes) * 100);
    console.log(
      `${ok ? 'ok  ' : 'FAIL'}  ${budget.label.padEnd(30)} ${kb(actual).padStart(9)} / ${kb(budget.bytes).padStart(9)}  (${String(pct)}%)${detail ? `  ${detail}` : ''}`,
    );
  }

  if (failed) {
    console.error('\nPerformance budget exceeded.');
    process.exit(1);
  }
  console.log('\nWithin budget.');
}

main();
