/**
 * Build-time data pipeline.
 *
 * Pulls the Torah, Targum Onkelos and Rashi from Sefaria, slices them by parsha
 * and aliyah, precomputes the parsha-by-week calendar, and writes static JSON.
 * The output is committed, so app builds and the running app never touch the
 * network. Re-run with `npm run data:build`.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HebrewCalendar, HDate } from '@hebcal/core';
import {
  fetchParshiyot,
  fetchText,
  listVersions,
  resolveEdition,
  type EditionPreference,
  type ParashaEntry,
  type ResolvedEdition,
} from './sefaria.js';
import { parseRef, verseKey, formatRange, toSlug, normalizeName } from '../src/lib/refs.js';
import { parseRuns, stripMarkup } from '../src/lib/hebrew.js';
import type { RichRun } from '../src/lib/schema.js';
import {
  BOOKS,
  parshaTextSchema,
  rashiTextSchema,
  parshiyotIndexSchema,
  calendarSchema,
  attributionSchema,
  type Book,
  type Verse,
  type Aliyah,
  type ParshaMeta,
  type ParshaCombo,
  type ParshaText,
} from '../src/lib/schema.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_DATA = join(ROOT, 'src/data');
const PUB_PARSHA = join(ROOT, 'public/data/parsha');
const PUB_RASHI = join(ROOT, 'public/data/rashi');

/**
 * Ordered edition preferences. Every first choice is Public Domain; the
 * fallbacks exist so a Sefaria retitling degrades gracefully instead of
 * breaking the build. What actually got picked is recorded in attribution.json.
 */
const startsWith = (prefix: string) => (title: string) =>
  title.trim().toLowerCase().startsWith(prefix.toLowerCase());
const includes = (needle: string) => (title: string) =>
  title.toLowerCase().includes(needle.toLowerCase());
// Some titles share a prefix with a worse-licensed variant — e.g. "Metsudah
// Chumash, Metsudah Publications, 2009" (CC-BY) vs the same title suffixed
// "[with Onkelos translation]" (CC-BY-NC). Only an exact match is safe there.
const exact = (title: string) => (t: string) => t.trim() === title;

const PREFS = {
  torahHe: {
    language: 'he',
    label: 'Torah Hebrew',
    match: [startsWith("Tanach with Ta'amei Hamikra"), includes("ta'amei hamikra"), includes('miqra')],
  },
  torahEn: {
    language: 'en',
    label: 'Torah English',
    // Metsudah reads more modern than the 1917 JPS wording it replaces; both
    // are Public Domain/CC-BY, so this is a pure upgrade in readability.
    match: [
      exact('Metsudah Chumash, Metsudah Publications, 2009'),
      includes('JPS 1917'),
      includes('The Holy Scriptures'),
    ],
  },
  onkelos: {
    language: 'he',
    label: 'Targum Onkelos',
    // Deliberately NOT Metsudah's Sifsei Chachomim edition here — it is
    // CC-BY-NC, which would block ever monetizing the app. The Onkelos verse
    // text itself is not a "translation style" choice the way Torah/Rashi
    // English is, so there is nothing to gain by accepting that restriction.
    match: [startsWith('Onkelos'), includes('Yemenite Taj')],
  },
  rashiHe: {
    language: 'he',
    label: 'Rashi Hebrew',
    match: [
      exact('Rashi Chumash, Metsudah Publications, 2009'),
      startsWith("Pentateuch with Rashi's commentary"),
    ],
  },
  rashiEn: {
    language: 'en',
    label: 'Rashi English',
    // Paired with the Metsudah Hebrew above (not Rosenbaum-Silbermann's):
    // an English translation is written against its own edition's comment
    // segmentation, and the two must be fetched from the same edition for
    // the per-comment he[i]/en[i] pairing built in buildParsha to line up.
    match: [
      exact('Rashi Chumash, Metsudah Publications, 2009'),
      startsWith("Pentateuch with Rashi's commentary"),
      includes('Sefaria'),
    ],
  },
} as const satisfies Record<string, EditionPreference>;

/** Records which edition was actually used, so attribution can never drift. */
const chosenEditions = new Map<string, ResolvedEdition & { role: string }>();

function record(role: string, edition: ResolvedEdition): ResolvedEdition {
  if (!chosenEditions.has(role)) chosenEditions.set(role, { ...edition, role });
  return edition;
}

// ---------------------------------------------------------------------------
// Text shape helpers. Sefaria returns nested string arrays; depth varies by
// corpus (2 for Tanakh, 3 for commentary).
// ---------------------------------------------------------------------------

type Chapters = string[][];
type CommentaryChapters = RichRun[][][][];

function asChapters(raw: unknown, label: string): Chapters {
  if (!Array.isArray(raw)) throw new Error(`${label}: expected an array of chapters`);
  return raw.map((chapter, ci) => {
    if (!Array.isArray(chapter)) throw new Error(`${label}: chapter ${String(ci + 1)} is not an array`);
    return chapter.map((verse) => (typeof verse === 'string' ? stripMarkup(verse) : ''));
  });
}

function asCommentaryChapters(raw: unknown, label: string): CommentaryChapters {
  if (!Array.isArray(raw)) throw new Error(`${label}: expected an array of chapters`);
  return raw.map((chapter) => {
    if (!Array.isArray(chapter)) return [];
    return chapter.map((verse) => {
      if (!Array.isArray(verse)) return [];
      return verse
        .map((c) => (typeof c === 'string' ? parseRuns(c) : []))
        .filter((runs) => runs.length > 0);
    });
  });
}

const at = (chapters: Chapters, c: number, v: number): string => chapters[c - 1]?.[v - 1] ?? '';
const commentsAt = (chapters: CommentaryChapters, c: number, v: number): RichRun[][] =>
  chapters[c - 1]?.[v - 1] ?? [];

// ---------------------------------------------------------------------------
// Book processing
// ---------------------------------------------------------------------------

interface BookCorpus {
  he: Chapters;
  en: Chapters;
  onkelos: Chapters;
  rashiHe: CommentaryChapters;
  rashiEn: CommentaryChapters;
}

async function fetchBook(book: Book): Promise<BookCorpus> {
  console.log(`  fetching ${book}…`);
  const torahRef = book;
  const onkelosRef = `Onkelos ${book}`;
  const rashiRef = `Rashi on ${book}`;

  const [torahVersions, onkelosVersions, rashiVersions] = await Promise.all([
    listVersions(torahRef),
    listVersions(onkelosRef),
    listVersions(rashiRef),
  ]);

  const editions = {
    he: record('Torah (Hebrew)', resolveEdition(torahVersions, PREFS.torahHe, torahRef)),
    en: record('Torah (English)', resolveEdition(torahVersions, PREFS.torahEn, torahRef)),
    onkelos: record('Targum Onkelos', resolveEdition(onkelosVersions, PREFS.onkelos, onkelosRef)),
    rashiHe: record('Rashi (Hebrew)', resolveEdition(rashiVersions, PREFS.rashiHe, rashiRef)),
    rashiEn: record('Rashi (English)', resolveEdition(rashiVersions, PREFS.rashiEn, rashiRef)),
  };
  for (const [role, ed] of Object.entries(editions)) {
    console.log(`    ${role.padEnd(8)} ${ed.versionTitle} [${ed.license}]`);
  }

  const [he, en, onkelos, rashiHe, rashiEn] = await Promise.all([
    fetchText(torahRef, editions.he),
    fetchText(torahRef, editions.en),
    fetchText(onkelosRef, editions.onkelos),
    fetchText(rashiRef, editions.rashiHe),
    fetchText(rashiRef, editions.rashiEn),
  ]);

  return {
    he: asChapters(he, `${book} he`),
    en: asChapters(en, `${book} en`),
    onkelos: asChapters(onkelos, onkelosRef),
    rashiHe: asCommentaryChapters(rashiHe, `${rashiRef} he`),
    rashiEn: asCommentaryChapters(rashiEn, `${rashiRef} en`),
  };
}

/** Walk every verse address from `start` through `end`, crossing chapters. */
function* walkVerses(
  chapters: Chapters,
  start: { c: number; v: number },
  end: { c: number; v: number },
): Generator<{ c: number; v: number }> {
  for (let c = start.c; c <= end.c; c++) {
    const length = chapters[c - 1]?.length ?? 0;
    if (length === 0) throw new Error(`Chapter ${String(c)} has no verses`);
    const first = c === start.c ? start.v : 1;
    const last = c === end.c ? end.v : length;
    for (let v = first; v <= last; v++) yield { c, v };
  }
}

interface BuiltParsha {
  text: ParshaText;
  rashi: { slug: string; comments: Record<string, { he: RichRun[]; en: RichRun[] }[]> };
  meta: Omit<ParshaMeta, 'order'>;
}

function buildParsha(book: Book, entry: ParashaEntry, corpus: BookCorpus): BuiltParsha {
  const whole = parseRef(entry.wholeRef);
  const slug = toSlug(entry.nameEn);

  const verses: Verse[] = [];
  const indexByKey = new Map<string, number>();
  for (const { c, v } of walkVerses(corpus.he, whole.start, whole.end)) {
    const he = at(corpus.he, c, v);
    if (!he) throw new Error(`${slug}: missing Hebrew at ${verseKey(c, v)}`);
    indexByKey.set(verseKey(c, v), verses.length);
    verses.push({ c, v, he, on: at(corpus.onkelos, c, v), en: at(corpus.en, c, v) });
  }

  const aliyot: Aliyah[] = entry.aliyotRefs.map((ref, i) => {
    const range = parseRef(ref);
    const from = indexByKey.get(verseKey(range.start.c, range.start.v));
    const to = indexByKey.get(verseKey(range.end.c, range.end.v));
    if (from === undefined || to === undefined) {
      throw new Error(`${slug}: aliyah ${String(i + 1)} ref "${ref}" falls outside ${entry.wholeRef}`);
    }
    return {
      n: i + 1,
      from,
      to,
      startRef: verseKey(range.start.c, range.start.v),
      endRef: verseKey(range.end.c, range.end.v),
    };
  });

  const comments: Record<string, { he: RichRun[]; en: RichRun[] }[]> = {};
  for (const { c, v } of verses) {
    const he = commentsAt(corpus.rashiHe, c, v);
    const en = commentsAt(corpus.rashiEn, c, v);
    const count = Math.max(he.length, en.length);
    if (count === 0) continue;
    const list = Array.from({ length: count }, (_, i) => ({
      he: he[i] ?? [],
      en: en[i] ?? [],
    })).filter((cm) => cm.he.length > 0 || cm.en.length > 0);
    if (list.length > 0) comments[verseKey(c, v)] = list;
  }

  const first = verses[0];
  const last = verses[verses.length - 1];
  if (!first || !last) throw new Error(`${slug}: produced no verses`);

  return {
    text: { slug, book, nameEn: entry.nameEn, nameHe: entry.nameHe, aliyot, verses },
    rashi: { slug, comments },
    meta: {
      slug,
      book,
      nameEn: entry.nameEn,
      nameHe: entry.nameHe,
      verseCount: verses.length,
      aliyotCount: aliyot.length,
      ref: formatRange(first, last),
    },
  };
}

// ---------------------------------------------------------------------------
// Validation — the build fails loudly rather than shipping broken text.
// ---------------------------------------------------------------------------

function validateParsha(built: BuiltParsha): string[] {
  const problems: string[] = [];
  const { slug, verses, aliyot } = built.text;

  const missingOnkelos = verses.filter((v) => v.on === '').length;
  if (missingOnkelos > 0) problems.push(`${slug}: ${String(missingOnkelos)} verses missing Onkelos`);
  const missingEnglish = verses.filter((v) => v.en === '').length;
  if (missingEnglish > 0) problems.push(`${slug}: ${String(missingEnglish)} verses missing English`);

  // Aliyot must tile the parsha exactly: start at 0, end at the last verse, no gaps or overlaps.
  const sorted = [...aliyot].sort((a, b) => a.from - b.from);
  if (sorted[0]?.from !== 0) problems.push(`${slug}: first aliyah does not start at verse 0`);
  if (sorted[sorted.length - 1]?.to !== verses.length - 1) {
    problems.push(`${slug}: last aliyah does not reach the final verse`);
  }
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (!a) continue;
    if (a.to < a.from) problems.push(`${slug}: aliyah ${String(a.n)} ends before it starts`);
    const next = sorted[i + 1];
    if (next && next.from !== a.to + 1) {
      problems.push(`${slug}: gap or overlap between aliyot ${String(a.n)} and ${String(next.n)}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

const CAL_START_YEAR = 2025;
const CAL_END_YEAR = 2050;

function iso(d: Date): string {
  return `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** First Saturday on or after Jan 1 of the start year. */
function firstShabbat(): Date {
  const d = new Date(CAL_START_YEAR, 0, 1);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return d;
}

function buildSchedule(il: boolean, resolve: (names: string[]) => string): string[] {
  const events = HebrewCalendar.calendar({
    start: new HDate(new Date(CAL_START_YEAR, 0, 1)),
    end: new HDate(new Date(CAL_END_YEAR, 11, 31)),
    sedrot: true,
    noHolidays: true,
    il,
  });

  const byDate = new Map<string, string>();
  for (const ev of events) {
    const parsha = (ev as { parsha?: string[] }).parsha;
    if (!parsha?.length) continue;
    byDate.set(iso(ev.getDate().greg()), resolve(parsha));
  }

  const weeks: string[] = [];
  const cursor = firstShabbat();
  const end = new Date(CAL_END_YEAR, 11, 31);
  while (cursor <= end) {
    weeks.push(byDate.get(iso(cursor)) ?? '');
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Fetching parsha structure and text from Sefaria…');

  const built: BuiltParsha[] = [];
  for (const book of BOOKS) {
    const [entries, corpus] = await Promise.all([fetchParshiyot(book), fetchBook(book)]);
    for (const entry of entries) built.push(buildParsha(book, entry, corpus));
    console.log(`  ${book}: ${String(entries.length)} parshiyot`);
  }

  const problems = built.flatMap(validateParsha);
  if (built.length !== 54) problems.push(`expected 54 parshiyot, got ${String(built.length)}`);
  if (problems.length > 0) {
    console.error('\nData validation failed:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const metaBySlug = new Map(built.map((b, i) => [b.meta.slug, { ...b.meta, order: i + 1 }]));
  const nameIndex = new Map([...metaBySlug.values()].map((m) => [normalizeName(m.nameEn), m]));

  // Combos are discovered from the calendar rather than hardcoded, so the two
  // sources can never drift apart.
  const combos = new Map<string, ParshaCombo>();
  const unmatched = new Set<string>();

  const resolve = (names: string[]): string => {
    const metas = names.map((n) => nameIndex.get(normalizeName(n)));
    if (metas.some((m) => m === undefined)) {
      for (const [i, m] of metas.entries()) if (!m) unmatched.add(names[i] ?? '?');
      return '';
    }
    const found = metas as ParshaMeta[];
    if (found.length === 1) return found[0]?.slug ?? '';
    const a = found[0];
    const b = found[1];
    if (!a || !b || found.length !== 2) return '';
    const slug = `${a.slug}-${b.slug}`;
    if (!combos.has(slug)) {
      combos.set(slug, {
        slug,
        parts: [a.slug, b.slug],
        nameEn: `${a.nameEn}-${b.nameEn}`,
        nameHe: `${a.nameHe}־${b.nameHe}`,
      });
    }
    return slug;
  };

  const diaspora = buildSchedule(false, resolve);
  const israel = buildSchedule(true, resolve);

  if (unmatched.size > 0) {
    console.error(`\nCalendar parsha names with no Sefaria match: ${[...unmatched].join(', ')}`);
    process.exit(1);
  }

  const index = parshiyotIndexSchema.parse({
    parshiyot: [...metaBySlug.values()],
    combos: [...combos.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
  });
  const calendar = calendarSchema.parse({ firstShabbat: iso(firstShabbat()), diaspora, israel });
  const attribution = attributionSchema.parse({
    generatedAt: new Date().toISOString().slice(0, 10),
    editions: [...chosenEditions.values()].map((e) => ({
      role: e.role,
      title: e.versionTitle,
      license: e.license,
      language: e.language,
    })),
  });

  await rm(PUB_PARSHA, { recursive: true, force: true });
  await rm(PUB_RASHI, { recursive: true, force: true });
  await mkdir(PUB_PARSHA, { recursive: true });
  await mkdir(PUB_RASHI, { recursive: true });
  await mkdir(SRC_DATA, { recursive: true });

  for (const b of built) {
    await writeFile(
      join(PUB_PARSHA, `${b.text.slug}.v1.json`),
      JSON.stringify(parshaTextSchema.parse(b.text)),
    );
    await writeFile(
      join(PUB_RASHI, `${b.rashi.slug}.v1.json`),
      JSON.stringify(rashiTextSchema.parse(b.rashi)),
    );
  }
  await writeFile(join(SRC_DATA, 'parshiyot.json'), `${JSON.stringify(index, null, 2)}\n`);
  await writeFile(join(SRC_DATA, 'calendar.json'), `${JSON.stringify(calendar)}\n`);
  await writeFile(join(SRC_DATA, 'attribution.json'), `${JSON.stringify(attribution, null, 2)}\n`);

  const totalVerses = built.reduce((n, b) => n + b.text.verses.length, 0);
  console.log(`\nWrote ${String(built.length)} parshiyot, ${String(totalVerses)} verses.`);
  console.log(`Combined parshiyot: ${[...combos.keys()].join(', ')}`);
  console.log(`Calendar: ${String(diaspora.length)} weeks from ${iso(firstShabbat())}.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
