import indexData from '../data/parshiyot.json' with { type: 'json' };
import { shabbatReading, type Region } from './torah-cycle.js';
import type {
  Book,
  ComboAliyah,
  ParshaCombo,
  ParshaMeta,
  ParshiyotIndex,
} from './types.js';

const index = indexData as ParshiyotIndex;

export type { Region };

export const PARSHIYOT: readonly ParshaMeta[] = index.parshiyot;
export const COMBOS: readonly ParshaCombo[] = index.combos;

const metaBySlug = new Map(PARSHIYOT.map((p) => [p.slug, p]));
const comboBySlug = new Map(COMBOS.map((c) => [c.slug, c]));

/**
 * V'Zot HaBerachah is read on Simchat Torah, not a Shabbat, so it never
 * appears in the weekly schedule — the weeks after Haazinu are just blank
 * until Bereshit. We treat that whole blank stretch as "V'Zot HaBerachah is
 * up next" instead of jumping straight to Bereshit.
 */
const VZOT_HABERACHAH_SLUG = 'vzot-haberachah';

/** How far ahead to look for the next regular reading when festivals displace one. */
const LOOKAHEAD_WEEKS = 8;

/** Walks back over blank weeks to find the reading that opened this gap. */
function gapOwner(shabbat: Date, region: Region): string | undefined {
  const cursor = new Date(shabbat);
  for (let i = 0; i < LOOKAHEAD_WEEKS; i++) {
    cursor.setDate(cursor.getDate() - 7);
    const slug = shabbatReading(cursor, region);
    if (slug !== '') return slug;
  }
  return undefined;
}

const addWeeks = (date: Date, weeks: number): Date => {
  const out = new Date(date);
  out.setDate(out.getDate() + weeks * 7);
  return out;
};

/** Midnight local time, so date maths never drifts on DST boundaries. */
function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toIsoDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** The Shabbat this reading is for: today if it is Saturday, else the next one. */
export function shabbatFor(date: Date): Date {
  const d = atMidnight(date);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return d;
}

export interface WeeklyReading {
  /** Slug of a parsha or of a combined pair. */
  slug: string;
  shabbat: Date;
  /** True when festivals displaced the reading and we looked ahead. */
  isUpcoming: boolean;
}

/**
 * The reading for the week containing `date`. On weeks where a festival
 * displaces the parsha, looks forward to the next regular reading — which is
 * what someone preparing shnayim mikra actually wants.
 */
export function readingForDate(date: Date, region: Region): WeeklyReading | undefined {
  const shabbat = shabbatFor(date);

  if (shabbatReading(shabbat, region) === '' && gapOwner(shabbat, region) === 'haazinu') {
    return { slug: VZOT_HABERACHAH_SLUG, shabbat, isUpcoming: true };
  }

  for (let i = 0; i < LOOKAHEAD_WEEKS; i++) {
    const target = addWeeks(shabbat, i);
    const slug = shabbatReading(target, region);
    if (slug !== '') return { slug, shabbat: target, isUpcoming: i !== 0 };
  }
  return undefined;
}

export interface ResolvedParsha {
  slug: string;
  nameEn: string;
  nameHe: string;
  /** One slug normally, two for a combined week. */
  parts: string[];
  isCombo: boolean;
  /** The seven aliyot of a combined reading; absent for a single parsha. */
  comboAliyot?: ComboAliyah[];
}

/** Resolve a route slug — plain or combined — to the parshiyot to load. */
export function resolveParsha(slug: string): ResolvedParsha | undefined {
  const combo = comboBySlug.get(slug);
  if (combo) {
    return {
      slug,
      nameEn: combo.nameEn,
      nameHe: combo.nameHe,
      parts: [...combo.parts],
      isCombo: true,
      comboAliyot: combo.aliyot,
    };
  }
  const meta = metaBySlug.get(slug);
  if (meta) {
    return { slug, nameEn: meta.nameEn, nameHe: meta.nameHe, parts: [slug], isCombo: false };
  }
  return undefined;
}

export function parshaMeta(slug: string): ParshaMeta | undefined {
  return metaBySlug.get(slug);
}

/** Reading order position, so combined weeks sort with their first half. */
export function readingOrder(slug: string): number {
  const resolved = resolveParsha(slug);
  const first = resolved?.parts[0];
  return (first === undefined ? undefined : metaBySlug.get(first)?.order) ?? Number.MAX_SAFE_INTEGER;
}

/** The upcoming readings after `date`, for the "jump to a parsha" list. */
export function upcomingReadings(date: Date, region: Region, count: number): WeeklyReading[] {
  const out: WeeklyReading[] = [];
  const cursor = shabbatFor(date);
  let vzotEmittedForGap = false;
  // Festival gaps are a few weeks at most, so this bound is generous.
  for (let week = 0; out.length < count && week < count * 4 + LOOKAHEAD_WEEKS; week++) {
    const target = addWeeks(cursor, week);
    const slug = shabbatReading(target, region);
    if (slug === '') {
      if (!vzotEmittedForGap && gapOwner(target, region) === 'haazinu') {
        out.push({ slug: VZOT_HABERACHAH_SLUG, shabbat: target, isUpcoming: out.length > 0 });
        vzotEmittedForGap = true;
      }
      continue;
    }
    out.push({ slug, shabbat: target, isUpcoming: out.length > 0 });
    vzotEmittedForGap = false;
  }
  return out;
}

export interface BookRow {
  slug: string;
  nameEn: string;
  nameHe: string;
  /** Verse range for a single parsha; "PartA + PartB" for a combined week. */
  subtitle: string;
  isCombo: boolean;
}

/**
 * A book's browse-list rows: every parsha in reading order, with each combined
 * week's entry inserted right after its second half — so a reader can jump
 * straight to whichever way that week is actually read, without needing to
 * know in advance whether a given year doubles it up.
 */
export function bookRows(book: Book): BookRow[] {
  const comboBySecondPart = new Map(COMBOS.map((c) => [c.parts[1], c]));
  const rows: BookRow[] = [];

  for (const meta of PARSHIYOT) {
    if (meta.book !== book) continue;
    rows.push({ slug: meta.slug, nameEn: meta.nameEn, nameHe: meta.nameHe, subtitle: meta.ref, isCombo: false });

    const combo = comboBySecondPart.get(meta.slug);
    if (combo) {
      const [aSlug, bSlug] = combo.parts;
      const a = metaBySlug.get(aSlug);
      const b = metaBySlug.get(bSlug);
      rows.push({
        slug: combo.slug,
        nameEn: combo.nameEn,
        nameHe: combo.nameHe,
        subtitle: `${a?.nameEn ?? aSlug} + ${b?.nameEn ?? bSlug}`,
        isCombo: true,
      });
    }
  }
  return rows;
}
