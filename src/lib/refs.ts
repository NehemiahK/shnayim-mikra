/** A chapter:verse address within a book. */
export interface VerseAddress {
  c: number;
  v: number;
}

export interface RefRange {
  book: string;
  start: VerseAddress;
  end: VerseAddress;
}

/** Stable key for a verse within a parsha, e.g. "12:3". */
export function verseKey(c: number, v: number): string {
  return `${String(c)}:${String(v)}`;
}

/** Sefaria mixes hyphens and en/em dashes in range refs. */
const DASH = '[-\u2010-\u2015\u2212]';
const REF_RE = new RegExp(
  `^(?<book>.+?)\\s+(?<c1>\\d+):(?<v1>\\d+)(?:\\s*${DASH}\\s*(?:(?<c2>\\d+):)?(?<v2>\\d+))?$`,
  'u',
);

/**
 * Parse a Sefaria ref. Handles the three shapes Sefaria emits:
 * "Genesis 1:1", "Genesis 2:4-19" (same chapter), "Genesis 1:1-6:8" (spanning).
 */
export function parseRef(ref: string): RefRange {
  const m = REF_RE.exec(ref.trim());
  const g = m?.groups;
  if (!g?.book || !g.c1 || !g.v1) throw new Error(`Unparseable ref: "${ref}"`);

  const c1 = Number(g.c1);
  const v1 = Number(g.v1);
  const end: VerseAddress = g.v2
    ? { c: g.c2 ? Number(g.c2) : c1, v: Number(g.v2) }
    : { c: c1, v: v1 };

  return { book: g.book.trim(), start: { c: c1, v: v1 }, end };
}

/** Order comparison for verse addresses. Negative if `a` precedes `b`. */
export function compareAddress(a: VerseAddress, b: VerseAddress): number {
  return a.c === b.c ? a.v - b.v : a.c - b.c;
}

export function isWithin(addr: VerseAddress, range: RefRange): boolean {
  return compareAddress(addr, range.start) >= 0 && compareAddress(addr, range.end) <= 0;
}

/** Render a range compactly: "1:1-6:8", or "5:2-9" when it stays in one chapter. */
export function formatRange(start: VerseAddress, end: VerseAddress): string {
  if (start.c === end.c) {
    return start.v === end.v
      ? verseKey(start.c, start.v)
      : `${verseKey(start.c, start.v)}-${String(end.v)}`;
  }
  return `${verseKey(start.c, start.v)}-${verseKey(end.c, end.v)}`;
}

/** Turn an English parsha name into a URL slug: "Lech Lecha" -> "lech-lecha". */
export function toSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/gu, '')
    .toLowerCase()
    .replace(/['’`]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

/**
 * Loose key for matching parsha names across sources (Sefaria vs. hebcal spell
 * them differently: "Lech Lecha" vs "Lech-Lecha", "Sh'lach" vs "Shlach").
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '');
}
