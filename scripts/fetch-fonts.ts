/**
 * Downloads the Hebrew subset of Noto Serif Hebrew for self-hosting.
 *
 * Self-hosted rather than linked, because the app must render correctly
 * offline — and because cantillation marks need a font with proper mark
 * positioning, which most system Hebrew fonts do not reliably provide.
 * Run with `npm run fonts:build`; output is committed.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(fileURLToPath(new URL('..', import.meta.url)), 'public/fonts');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

interface FontFace {
  weight: string;
  url: string;
}

/** Pull only the @font-face blocks that actually cover the Hebrew block. */
function hebrewFaces(css: string): FontFace[] {
  const faces: FontFace[] = [];
  for (const block of css.split('@font-face').slice(1)) {
    if (!/unicode-range:[^;]*U\+0590-05FF/u.test(block)) continue;
    const weight = /font-weight:\s*(\d+)/u.exec(block)?.[1];
    const url = /src:\s*url\((https:[^)]+\.woff2)\)/u.exec(block)?.[1];
    if (weight && url) faces.push({ weight, url });
  }
  return faces;
}

async function main(): Promise<void> {
  const cssUrl =
    'https://fonts.googleapis.com/css2?family=Noto+Serif+Hebrew:wght@400;600&display=swap';
  const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text();
  const faces = hebrewFaces(css);
  if (faces.length === 0) throw new Error('No Hebrew subset found in the Google Fonts CSS');

  // Noto Serif Hebrew is a variable font: Google serves one file for every
  // weight, so we store it once and declare a weight range in CSS.
  const unique = [...new Map(faces.map((f) => [f.url, f])).values()];
  await mkdir(OUT, { recursive: true });
  for (const face of unique) {
    const res = await fetch(face.url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${String(res.status)} for ${face.url}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    await writeFile(join(OUT, 'noto-serif-hebrew.woff2'), bytes);
    console.log(`  noto-serif-hebrew.woff2 — ${String(Math.round(bytes.length / 1024))} KB`);
  }
  if (unique.length !== 1) {
    console.warn(`  note: ${String(unique.length)} distinct files; only the last was kept`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
