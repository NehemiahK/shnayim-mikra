import calendarData from '../data/calendar.json' with { type: 'json' };
import indexData from '../data/parshiyot.json' with { type: 'json' };
import type {
  Book,
  Calendar,
  ComboAliyah,
  ParshaCombo,
  ParshaMeta,
  ParshiyotIndex,
} from './types.js';

const calendar = calendarData as Calendar;
const index = indexData as ParshiyotIndex;

export type Region = 'diaspora' | 'israel';

export const PARSHIYOT: readonly ParshaMeta[] = index.parshiyot;
export const COMBOS: readonly ParshaCombo[] = index.combos;

const metaBySlug = new Map(PARSHIYOT.map((p) => [p.slug, p]));
const comboBySlug = new Map(COMBOS.map((c) => [c.slug, c]));

const MS_PER_DAY = 86_400_000;

/** Midnight local time, so date maths never drifts on DST boundaries. */
function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
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

function weekIndex(shabbat: Date): number {
  const first = parseIsoDate(calendar.firstShabbat);
  return Math.round((shabbat.getTime() - first.getTime()) / (7 * MS_PER_DAY));
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
  const schedule = calendar[region];
  const shabbat = shabbatFor(date);
  const start = weekIndex(shabbat);
  if (start < 0) return undefined;

  for (let i = start; i < schedule.length && i < start + 8; i++) {
    const slug = schedule[i];
    if (slug !== undefined && slug !== '') {
      const target = new Date(shabbat);
      target.setDate(target.getDate() + (i - start) * 7);
      return { slug, shabbat: target, isUpcoming: i !== start };
    }
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
  const schedule = calendar[region];
  let i = weekIndex(cursor);
  while (out.length < count && i < schedule.length) {
    const slug = schedule[i];
    if (slug !== undefined && slug !== '') {
      const target = new Date(cursor);
      target.setDate(target.getDate() + (i - weekIndex(cursor)) * 7);
      out.push({ slug, shabbat: target, isUpcoming: out.length > 0 });
    }
    i++;
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
