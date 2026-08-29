/**
 * Guards the committed corpus. These are the tests that would catch a bad
 * `npm run data:build` before it ever reaches a reader.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calendarSchema,
  parshaTextSchema,
  parshiyotIndexSchema,
  rashiTextSchema,
  attributionSchema,
  BOOKS,
  type ParshaText,
} from '../src/lib/schema.js';
import { parseRef, verseKey } from '../src/lib/refs.js';
import { PARSHA_DATA_VERSION, RASHI_DATA_VERSION } from '../src/lib/data-version.js';

const ROOT = process.cwd();
const PARSHA_DIR = join(ROOT, 'public/data/parsha');
const RASHI_DIR = join(ROOT, 'public/data/rashi');

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const index = parshiyotIndexSchema.parse(readJson(join(ROOT, 'src/data/parshiyot.json')));
const calendar = calendarSchema.parse(readJson(join(ROOT, 'src/data/calendar.json')));
const parshaFiles = readdirSync(PARSHA_DIR).filter((f) => f.endsWith('.json'));
const texts = new Map<string, ParshaText>(
  parshaFiles.map((f) => {
    const parsed = parshaTextSchema.parse(readJson(join(PARSHA_DIR, f)));
    return [parsed.slug, parsed];
  }),
);

describe('corpus completeness', () => {
  it('has all 54 parshiyot as text and index entries', () => {
    expect(parshaFiles).toHaveLength(54);
    expect(index.parshiyot).toHaveLength(54);
    expect(texts.size).toBe(54);
  });

  it('ships files under exactly the version the app asks for', () => {
    // The filename is the only cache-buster: /data is immutable for a year and
    // CacheFirst in the service worker. If the writer and the reader disagree
    // about the version, every existing install keeps a stale, differently
    // shaped payload — which is how adding `oe` crashed the reader.
    for (const meta of index.parshiyot) {
      expect(parshaFiles).toContain(`${meta.slug}.${PARSHA_DATA_VERSION}.json`);
    }
    expect(parshaFiles.every((f) => f.endsWith(`.${PARSHA_DATA_VERSION}.json`))).toBe(true);
  });

  it('has a Rashi file for every parsha', () => {
    const rashiFiles = readdirSync(RASHI_DIR).filter((f) => f.endsWith('.json'));
    expect(rashiFiles).toHaveLength(54);
    for (const meta of index.parshiyot) {
      expect(rashiFiles).toContain(`${meta.slug}.${RASHI_DATA_VERSION}.json`);
    }
  });

  it('agrees between index metadata and text files', () => {
    for (const meta of index.parshiyot) {
      const text = texts.get(meta.slug);
      expect(text, `missing text for ${meta.slug}`).toBeDefined();
      expect(text?.verses).toHaveLength(meta.verseCount);
      expect(text?.aliyot).toHaveLength(meta.aliyotCount);
      expect(text?.nameEn).toBe(meta.nameEn);
      expect(text?.book).toBe(meta.book);
    }
  });

  it('covers every book, in reading order', () => {
    const order = index.parshiyot.map((p) => p.book);
    const firstSeen = BOOKS.map((b) => order.indexOf(b));
    expect(firstSeen.every((i) => i >= 0)).toBe(true);
    expect([...firstSeen].sort((a, b) => a - b)).toEqual(firstSeen);
  });
});

describe('every parsha', () => {
  it.each([...texts.keys()])('%s is internally consistent', (slug) => {
    const parsha = texts.get(slug);
    expect(parsha).toBeDefined();
    if (!parsha) return;

    // Verses ascend and never repeat.
    let prev = { c: 0, v: 0 };
    for (const verse of parsha.verses) {
      const ascends = verse.c > prev.c || (verse.c === prev.c && verse.v > prev.v);
      expect(ascends, `${slug} ${verseKey(verse.c, verse.v)} does not follow ${verseKey(prev.c, prev.v)}`).toBe(true);
      prev = { c: verse.c, v: verse.v };
    }

    // Every verse carries all three texts — a missing one is a missed reading.
    for (const verse of parsha.verses) {
      const at = `${slug} ${verseKey(verse.c, verse.v)}`;
      expect(verse.he.length, `${at} Hebrew`).toBeGreaterThan(0);
      expect(verse.on.length, `${at} Onkelos`).toBeGreaterThan(0);
      expect(verse.en.length, `${at} English`).toBeGreaterThan(0);
    }

    // Aliyot tile the parsha exactly: no gaps, no overlaps, full coverage.
    const aliyot = [...parsha.aliyot].sort((a, b) => a.from - b.from);
    expect(aliyot[0]?.from).toBe(0);
    expect(aliyot[aliyot.length - 1]?.to).toBe(parsha.verses.length - 1);
    for (const [i, aliyah] of aliyot.entries()) {
      expect(aliyah.to).toBeGreaterThanOrEqual(aliyah.from);
      const next = aliyot[i + 1];
      if (next) expect(next.from).toBe(aliyah.to + 1);
    }

    // Aliyah ref labels must match the verses they point at.
    for (const aliyah of aliyot) {
      const first = parsha.verses[aliyah.from];
      const last = parsha.verses[aliyah.to];
      expect(aliyah.startRef).toBe(verseKey(first?.c ?? 0, first?.v ?? 0));
      expect(aliyah.endRef).toBe(verseKey(last?.c ?? 0, last?.v ?? 0));
    }
  });
});

describe('books are fully covered', () => {
  it.each(BOOKS)('%s has no gaps between parshiyot', (book) => {
    const inBook = index.parshiyot
      .filter((p) => p.book === book)
      .map((p) => texts.get(p.slug))
      .filter((t): t is ParshaText => t !== undefined)
      .sort((a, b) => {
        const av = a.verses[0];
        const bv = b.verses[0];
        return (av?.c ?? 0) - (bv?.c ?? 0) || (av?.v ?? 0) - (bv?.v ?? 0);
      });

    expect(inBook[0]?.verses[0]).toMatchObject({ c: 1, v: 1 });

    let prev: { c: number; v: number } | undefined;
    for (const parsha of inBook) {
      const first = parsha.verses[0];
      if (prev && first) {
        const contiguous =
          (first.c === prev.c && first.v === prev.v + 1) || (first.c === prev.c + 1 && first.v === 1);
        expect(contiguous, `${book}: ${parsha.slug} does not follow ${verseKey(prev.c, prev.v)}`).toBe(true);
      }
      const last = parsha.verses[parsha.verses.length - 1];
      if (last) prev = { c: last.c, v: last.v };
    }
  });
});

describe('rashi', () => {
  it.each([...texts.keys()])('%s comments all land on real verses', (slug) => {
    const rashi = rashiTextSchema.parse(readJson(join(RASHI_DIR, `${slug}.${RASHI_DATA_VERSION}.json`)));
    const parsha = texts.get(slug);
    if (!parsha) throw new Error('missing parsha');
    const valid = new Set(parsha.verses.map((v) => verseKey(v.c, v.v)));

    expect(rashi.slug).toBe(slug);
    for (const [key, comments] of Object.entries(rashi.comments)) {
      expect(valid.has(key), `${slug}: Rashi on ${key} is outside the parsha`).toBe(true);
      expect(comments.length).toBeGreaterThan(0);
      for (const c of comments) expect(c.he.length + c.en.length).toBeGreaterThan(0);
    }
  });

  it('covers a meaningful share of verses', () => {
    let withRashi = 0;
    let totalVerses = 0;
    for (const [slug, parsha] of texts) {
      const rashi = rashiTextSchema.parse(readJson(join(RASHI_DIR, `${slug}.${RASHI_DATA_VERSION}.json`)));
      withRashi += Object.keys(rashi.comments).length;
      totalVerses += parsha.verses.length;
    }
    // Rashi does not comment on every verse, but should cover most of the Torah.
    expect(withRashi / totalVerses).toBeGreaterThan(0.5);
  });
});

describe('combined parshiyot', () => {
  it('names the canonical seven pairs', () => {
    expect(index.combos.map((c) => c.slug).sort()).toEqual(
      [
        'achrei-mot-kedoshim',
        'behar-bechukotai',
        'chukat-balak',
        'matot-masei',
        'nitzavim-vayeilech',
        'tazria-metzora',
        'vayakhel-pekudei',
      ].sort(),
    );
  });

  it('carries the seven aliyot the combined week is actually read with', () => {
    for (const combo of index.combos) {
      expect(combo.aliyot, combo.slug).toHaveLength(7);
      expect(combo.aliyot.map((a) => a.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    }
  });

  it('has combined aliyot that tile the pair with no gap or overlap', () => {
    for (const combo of index.combos) {
      const [aSlug, bSlug] = combo.parts;
      const verses = [...(texts.get(aSlug)?.verses ?? []), ...(texts.get(bSlug)?.verses ?? [])];
      const order = new Map(verses.map((v, i) => [verseKey(v.c, v.v), i]));

      let expectedStart = 0;
      for (const aliyah of combo.aliyot) {
        const from = order.get(aliyah.startRef);
        const to = order.get(aliyah.endRef);
        expect(from, `${combo.slug} aliyah ${String(aliyah.n)} start`).toBe(expectedStart);
        expect(to, `${combo.slug} aliyah ${String(aliyah.n)} end`).toBeDefined();
        expect(to).toBeGreaterThanOrEqual(from ?? 0);
        expectedStart = (to ?? 0) + 1;
      }
      // The last aliyah must land exactly on the final verse of the pair.
      expect(expectedStart, combo.slug).toBe(verses.length);
    }
  });

  it('joins the two halves with an aliyah that spans the boundary', () => {
    // This is what makes combined divisions genuinely different from reading
    // each parsha's own seven back to back, and why they cannot be derived by
    // concatenation: one aliyah always straddles the seam. In every pair it is
    // the fourth, sitting at the middle of the seven.
    const toKey = (ref: string): [number, number] => {
      const [c, v] = ref.split(':').map(Number);
      return [c ?? 0, v ?? 0];
    };
    const before = (a: [number, number], b: [number, number]): boolean =>
      a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

    for (const combo of index.combos) {
      const firstHalf = texts.get(combo.parts[0]);
      const seam = firstHalf?.verses[firstHalf.verses.length - 1];
      expect(seam, combo.slug).toBeDefined();
      const seamKey: [number, number] = [seam?.c ?? 0, seam?.v ?? 0];

      const spanning = combo.aliyot.filter(
        (a) =>
          !before(seamKey, toKey(a.startRef)) && before(seamKey, toKey(a.endRef)),
      );
      expect(spanning.map((a) => a.n), `${combo.slug} spanning aliyah`).toEqual([4]);
    }
  });

  it('points at real, consecutive parshiyot', () => {
    for (const combo of index.combos) {
      const [a, b] = combo.parts;
      expect(texts.has(a), `${combo.slug} part ${a}`).toBe(true);
      expect(texts.has(b), `${combo.slug} part ${b}`).toBe(true);
      const orderA = index.parshiyot.find((p) => p.slug === a)?.order ?? 0;
      const orderB = index.parshiyot.find((p) => p.slug === b)?.order ?? 0;
      expect(orderB).toBe(orderA + 1);
    }
  });
});

describe('calendar', () => {
  it('is dense and covers both regions equally', () => {
    expect(calendar.diaspora.length).toBe(calendar.israel.length);
    expect(calendar.diaspora.length).toBeGreaterThan(1000);
  });

  it('only ever names known readings', () => {
    const known = new Set([
      ...index.parshiyot.map((p) => p.slug),
      ...index.combos.map((c) => c.slug),
      '',
    ]);
    for (const region of ['diaspora', 'israel'] as const) {
      for (const slug of calendar[region]) {
        expect(known.has(slug), `unknown reading "${slug}" in ${region}`).toBe(true);
      }
    }
  });

  it('diverges between Israel and the diaspora at least once', () => {
    const differences = calendar.diaspora.filter((slug, i) => slug !== calendar.israel[i]);
    expect(differences.length).toBeGreaterThan(0);
  });

  it('reads all 53 Shabbat parshiyot within a 60-week window', () => {
    const window = calendar.diaspora.slice(0, 60).filter((s) => s !== '');
    const covered = new Set<string>();
    for (const slug of window) {
      const combo = index.combos.find((c) => c.slug === slug);
      if (combo) combo.parts.forEach((p) => covered.add(p));
      else covered.add(slug);
    }
    // V'Zot HaBerachah is read on Simchat Torah, a festival, so it never falls
    // on a regular Shabbat and never appears in the weekly schedule.
    expect(covered.size).toBe(53);
    expect(covered.has('vzot-haberachah')).toBe(false);
  });

  it('leaves V\'Zot HaBerachah readable even though it is never scheduled', () => {
    const scheduled = new Set(calendar.diaspora.concat(calendar.israel));
    expect(scheduled.has('vzot-haberachah')).toBe(false);
    // It must still exist as browsable text — people read it before Simchat Torah.
    expect(index.parshiyot.some((p) => p.slug === 'vzot-haberachah')).toBe(true);
    expect(texts.has('vzot-haberachah')).toBe(true);
  });
});

describe('attribution', () => {
  it('records a license for every edition actually used', () => {
    const attribution = attributionSchema.parse(readJson(join(ROOT, 'src/data/attribution.json')));
    expect(attribution.editions.length).toBeGreaterThanOrEqual(5);
    for (const edition of attribution.editions) {
      expect(edition.title.length).toBeGreaterThan(0);
      expect(edition.license).not.toBe('unknown');
    }
  });
});

describe('ref parsing against the real corpus', () => {
  it('round-trips every aliyah ref shape Sefaria produced', () => {
    for (const parsha of texts.values()) {
      for (const aliyah of parsha.aliyot) {
        const range = parseRef(`${parsha.book} ${aliyah.startRef}-${aliyah.endRef}`);
        expect(verseKey(range.start.c, range.start.v)).toBe(aliyah.startRef);
      }
    }
  });
});
