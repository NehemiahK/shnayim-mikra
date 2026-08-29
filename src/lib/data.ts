import type { ParshaText, RashiText } from './types.js';
import { PARSHA_DATA_VERSION, RASHI_DATA_VERSION } from './data-version.js';

/**
 * Text is a static, versioned asset served from our own origin and validated
 * exhaustively at build time (and again in the data tests), so the runtime only
 * needs a cheap structural guard — shipping Zod to every reader would cost more
 * than it buys.
 */
function assertParshaText(value: unknown, slug: string): ParshaText {
  const v = value as Partial<ParshaText> | null;
  if (
    !v ||
    typeof v.slug !== 'string' ||
    !Array.isArray(v.verses) ||
    v.verses.length === 0 ||
    !Array.isArray(v.aliyot) ||
    v.aliyot.length === 0
  ) {
    throw new Error(`Malformed parsha data for "${slug}"`);
  }

  // Backfill optional per-verse texts. The version suffix should already stop
  // a stale payload reaching us, but a single missing field must never be able
  // to take the whole reading down — losing one translation is recoverable,
  // a blank screen is not.
  for (const verse of v.verses) {
    if (!Array.isArray(verse.oe)) verse.oe = [];
  }
  return v as ParshaText;
}

function assertRashiText(value: unknown, slug: string): RashiText {
  const v = value as Partial<RashiText> | null;
  if (!v || typeof v.slug !== 'string' || typeof v.comments !== 'object' || v.comments === null) {
    throw new Error(`Malformed Rashi data for "${slug}"`);
  }
  return v as RashiText;
}

const parshaCache = new Map<string, Promise<ParshaText>>();
const rashiCache = new Map<string, Promise<RashiText>>();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${String(res.status)})`);
  return res.json();
}

export function parshaUrl(slug: string): string {
  return `${import.meta.env.BASE_URL}data/parsha/${slug}.${PARSHA_DATA_VERSION}.json`;
}

export function rashiUrl(slug: string): string {
  return `${import.meta.env.BASE_URL}data/rashi/${slug}.${RASHI_DATA_VERSION}.json`;
}

export function loadParsha(slug: string): Promise<ParshaText> {
  const cached = parshaCache.get(slug);
  if (cached) return cached;
  const promise = getJson(parshaUrl(slug))
    .then((raw) => assertParshaText(raw, slug))
    .catch((err: unknown) => {
      parshaCache.delete(slug); // let a transient failure be retried
      throw err;
    });
  parshaCache.set(slug, promise);
  return promise;
}

/** Rashi is a separate chunk, fetched only when a reader actually expands it. */
export function loadRashi(slug: string): Promise<RashiText> {
  const cached = rashiCache.get(slug);
  if (cached) return cached;
  const promise = getJson(rashiUrl(slug))
    .then((raw) => assertRashiText(raw, slug))
    .catch((err: unknown) => {
      rashiCache.delete(slug);
      throw err;
    });
  rashiCache.set(slug, promise);
  return promise;
}

export function loadParshiyot(slugs: readonly string[]): Promise<ParshaText[]> {
  return Promise.all(slugs.map(loadParsha));
}

/** Warm the service-worker cache so the whole year is readable offline. */
export async function prefetchAll(
  slugs: readonly string[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const total = slugs.length * 2;
  let done = 0;
  const bump = (): void => {
    done++;
    onProgress?.(done, total);
  };
  // Sequential-ish batching keeps a phone on cellular from opening 108 sockets.
  const BATCH = 6;
  for (let i = 0; i < slugs.length; i += BATCH) {
    await Promise.all(
      slugs.slice(i, i + BATCH).flatMap((slug) => [
        fetch(parshaUrl(slug)).then(bump, bump),
        fetch(rashiUrl(slug)).then(bump, bump),
      ]),
    );
  }
}
