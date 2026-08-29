/**
 * Runtime-free data contracts.
 *
 * These are hand-written types plus the handful of constants the app needs.
 * The matching Zod schemas live in `schema.ts` and are used only by the build
 * pipeline and the tests — keeping them out of this module is what stops Zod
 * from being pulled into the browser bundle.
 */

export const BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'] as const;
export type Book = (typeof BOOKS)[number];

export const HEBREW_BOOK_NAMES: Readonly<Record<Book, string>> = {
  Genesis: 'בְּרֵאשִׁית',
  Exodus: 'שְׁמוֹת',
  Leviticus: 'וַיִּקְרָא',
  Numbers: 'בְּמִדְבַּר',
  Deuteronomy: 'דְּבָרִים',
};

/** One verse, carrying every text we ship. All fields are plain text. */
export interface Verse {
  /** Chapter number within the book. */
  c: number;
  /** Verse number within the chapter. */
  v: number;
  /** Hebrew with full cantillation. Other Hebrew styles derive from this. */
  he: string;
  /** Targum Onkelos, vocalized. */
  on: string;
  /** English translation (JPS 1917). */
  en: string;
}

/** An aliyah, addressed as an inclusive index range into the parsha's verses. */
export interface Aliyah {
  n: number;
  from: number;
  to: number;
  startRef: string;
  endRef: string;
}

export interface ParshaText {
  slug: string;
  book: Book;
  nameEn: string;
  nameHe: string;
  aliyot: Aliyah[];
  verses: Verse[];
}

/**
 * A run of Rashi text. `b` marks the dibur hamatchil — the quoted lead phrase
 * that tells you which words the comment is on.
 */
export interface RichRun {
  t: string;
  b?: true;
}

export interface RashiComment {
  he: RichRun[];
  en: RichRun[];
}

export interface RashiText {
  slug: string;
  comments: Record<string, RashiComment[]>;
}

export interface ParshaMeta {
  slug: string;
  book: Book;
  nameEn: string;
  nameHe: string;
  /** 1-54, reading order through the year. */
  order: number;
  verseCount: number;
  aliyotCount: number;
  ref: string;
}

/**
 * A double parsha (e.g. Matot-Masei). Rather than duplicating text, a combo
 * points at the two parshiyot it is read with; the reader concatenates them.
 */
/** One aliyah of a combined reading, addressed by "chapter:verse" bounds. */
export interface ComboAliyah {
  n: number;
  startRef: string;
  endRef: string;
}

export interface ParshaCombo {
  slug: string;
  parts: [string, string];
  nameEn: string;
  nameHe: string;
  /**
   * The seven aliyot as the combined week is actually read. These are not
   * either parsha's own divisions and cannot be derived from them — a single
   * combined aliyah routinely spans the boundary between the two.
   */
  aliyot: ComboAliyah[];
}

export interface ParshiyotIndex {
  parshiyot: ParshaMeta[];
  combos: ParshaCombo[];
}

/**
 * Parsha-by-week lookup. `diaspora`/`israel` are dense: index N is the Shabbat
 * N weeks after `firstShabbat`. An empty string means a festival displaced the
 * weekly reading.
 */
export interface Calendar {
  firstShabbat: string;
  diaspora: string[];
  israel: string[];
}

export interface Attribution {
  generatedAt: string;
  editions: { role: string; title: string; license: string; language: string }[];
}
