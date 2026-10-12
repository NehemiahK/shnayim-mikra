import indexData from '../data/parshiyot.json' with { type: 'json' };
import type { ParshiyotIndex } from './types.js';

/**
 * Which parsha is read on which Shabbat, computed from the Hebrew calendar so it
 * keeps working indefinitely — no lookup table to run out.
 *
 * The shape of the reading year is fixed by tradition:
 *   - the cycle restarts with Bereshit on the first Shabbat after Simchat Torah;
 *   - the 53 Shabbat parshiyot are read in order, one per Shabbat, skipping
 *     Shabbatot a festival takes over;
 *   - when there are fewer free Shabbatot than parshiyot, some neighbouring
 *     pairs are read together. Which pairs depends only on the year's "type"
 *     (weekday of Rosh Hashana and the year's length) and on whether the
 *     reader is in Israel, where the extra festival day at the end of Pesach,
 *     Sukkot and Shavuot is not kept.
 */

export type Region = 'diaspora' | 'israel';

const index = indexData as ParshiyotIndex;
const SHABBAT_ORDER: readonly string[] = [...index.parshiyot]
  .filter((p) => p.slug !== 'vzot-haberachah')
  .sort((a, b) => a.order - b.order)
  .map((p) => p.slug);

const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Hebrew calendar arithmetic (the standard molad-based year computation).
// Days are counted as whole days since 1970-01-01 so that no time zone or
// daylight-saving shift can ever move a date.
// ---------------------------------------------------------------------------

/** Rata Die of 1970-01-01, and of Rosh Hashana of year 1. */
const RD_UNIX_EPOCH = 719_163;
const RD_HEBREW_EPOCH = -1_373_427;

function elapsedDays(year: number): number {
  const months = Math.floor((235 * year - 234) / 19);
  const parts = 12_084 + 13_753 * months;
  const days = 29 * months + Math.floor(parts / 25_920);
  return (3 * (days + 1)) % 7 < 3 ? days + 1 : days;
}

function yearLengthCorrection(year: number): number {
  const before = elapsedDays(year - 1);
  const now = elapsedDays(year);
  const after = elapsedDays(year + 1);
  if (after - now === 356) return 2;
  if (now - before === 382) return 1;
  return 0;
}

const roshHashanaCache = new Map<number, number>();

/** Day number of 1 Tishrei of a Hebrew year. */
function roshHashana(year: number): number {
  let day = roshHashanaCache.get(year);
  if (day === undefined) {
    day = RD_HEBREW_EPOCH + elapsedDays(year) + yearLengthCorrection(year) - RD_UNIX_EPOCH;
    roshHashanaCache.set(year, day);
  }
  return day;
}

/** 0 = Sunday … 6 = Saturday. */
const weekday = (day: number): number => (((day + 4) % 7) + 7) % 7;

/** The Hebrew year a day falls in. */
function hebrewYearOf(day: number): number {
  // A mean year is 365.2468 days; start from that estimate and settle exactly.
  let year = Math.floor((day + RD_UNIX_EPOCH - RD_HEBREW_EPOCH) / 365.2468) + 1;
  while (roshHashana(year + 1) <= day) year++;
  while (roshHashana(year) > day) year--;
  return year;
}

// ---------------------------------------------------------------------------
// Festival Shabbatot
// ---------------------------------------------------------------------------

/**
 * Whether a festival, not the weekly parsha, is read on this Shabbat: Rosh
 * Hashana, Yom Kippur, Sukkot through Simchat Torah, Pesach and Shavuot.
 * Chanukah, Purim and the fasts leave the weekly parsha in place.
 */
function isFestivalShabbat(day: number, region: Region): boolean {
  const year = hebrewYearOf(day);
  const offset = day - roshHashana(year);
  const il = region === 'israel';

  if (offset <= 1) return true; // Rosh Hashana
  if (offset === 9) return true; // Yom Kippur
  if (offset >= 14 && offset <= (il ? 21 : 22)) return true; // Sukkot through Simchat Torah

  const nisan1 = roshHashana(year + 1) - roshHashana(year) - 177;
  const pesach = offset - (nisan1 + 14);
  if (pesach >= 0 && pesach <= (il ? 6 : 7)) return true;

  const shavuot = offset - (nisan1 + 64);
  return shavuot === 0 || (!il && shavuot === 1);
}

/** First Shabbat after Simchat Torah — Bereshit — for the cycle begun in `year`. */
function bereshitShabbat(year: number, region: Region): number {
  const simchatTorah = roshHashana(year) + (region === 'israel' ? 21 : 22);
  return simchatTorah + (((6 - weekday(simchatTorah) + 7) % 7) || 7);
}

// ---------------------------------------------------------------------------
// Which pairs are read together
// ---------------------------------------------------------------------------

/**
 * The first half of each pair that is read together within a Hebrew year,
 * keyed by the year's length and the weekday of its Rosh Hashana. Nitzavim and
 * Vayeilech are handled separately, since they depend on the *next* year.
 */
const V = 'vayakhel';
const T = 'tazria';
const A = 'achrei-mot';
const B = 'behar';
const C = 'chukat';
const M = 'matot';

interface YearType {
  diaspora: readonly string[];
  israel: readonly string[];
}

const YEAR_TYPES: Record<string, YearType> = {
  // Ordinary years: Rosh Hashana on Monday, Tuesday, Thursday or Saturday.
  '353-1': { diaspora: [V, T, A, B, M], israel: [V, T, A, B, M] },
  '353-6': { diaspora: [V, T, A, B, M], israel: [V, T, A, B, M] },
  '354-2': { diaspora: [V, T, A, B, C, M], israel: [V, T, A, B, M] },
  '354-4': { diaspora: [V, T, A, B, M], israel: [V, T, A, M] },
  '355-1': { diaspora: [V, T, A, B, C, M], israel: [V, T, A, B, M] },
  '355-4': { diaspora: [T, A, B, M], israel: [T, A, B, M] },
  '355-6': { diaspora: [V, T, A, B, M], israel: [V, T, A, B, M] },
  // Leap years have more Shabbatot, so fewer parshiyot need pairing.
  '383-1': { diaspora: [C, M], israel: [M] },
  '383-4': { diaspora: [], israel: [] },
  '383-6': { diaspora: [M], israel: [M] },
  '384-2': { diaspora: [M], israel: [] },
  '385-1': { diaspora: [M], israel: [] },
  '385-4': { diaspora: [], israel: [] },
  '385-6': { diaspora: [C, M], israel: [M] },
};

// ---------------------------------------------------------------------------
// The schedule
// ---------------------------------------------------------------------------

const cycleCache = new Map<string, Map<number, string>>();

/** Every Shabbat of the reading cycle begun in `year`, mapped to its reading ('' for a festival or the post-Haazinu gap). */
function cycleSchedule(year: number, region: Region): Map<number, string> {
  const key = `${String(year)}-${region}`;
  const cached = cycleCache.get(key);
  if (cached) return cached;

  const length = roshHashana(year + 1) - roshHashana(year);
  const type = YEAR_TYPES[`${String(length)}-${String(weekday(roshHashana(year)))}`];
  const pairedFirsts = new Set(type?.[region] ?? []);
  // Nitzavim and Vayeilech split only when Rosh Hashana falls on a Monday or
  // Tuesday, leaving a Shabbat between it and Yom Kippur for Vayeilech.
  if (weekday(roshHashana(year + 1)) === 4 || weekday(roshHashana(year + 1)) === 6) {
    pairedFirsts.add('nitzavim');
  }

  const readings: string[] = [];
  for (let i = 0; i < SHABBAT_ORDER.length; i++) {
    const slug = SHABBAT_ORDER[i] ?? '';
    const next = SHABBAT_ORDER[i + 1];
    if (pairedFirsts.has(slug) && next !== undefined) {
      readings.push(`${slug}-${next}`);
      i++;
    } else {
      readings.push(slug);
    }
  }

  const schedule = new Map<number, string>();
  const end = bereshitShabbat(year + 1, region);
  let next = 0;
  for (let day = bereshitShabbat(year, region); day < end; day += 7) {
    const festival = isFestivalShabbat(day, region);
    schedule.set(day, festival ? '' : (readings[next++] ?? ''));
  }

  cycleCache.set(key, schedule);
  return schedule;
}

const toDayNumber = (date: Date): number =>
  Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);

/**
 * The reading for a Shabbat: a parsha slug, or a combined pair's slug. Empty
 * when a festival takes the Shabbat over, or in the stretch after Haazinu
 * before Bereshit begins the next cycle.
 */
export function shabbatReading(shabbat: Date, region: Region): string {
  const day = toDayNumber(shabbat);
  const year = hebrewYearOf(day);
  const cycle = day >= bereshitShabbat(year, region) ? year : year - 1;
  return cycleSchedule(cycle, region).get(day) ?? '';
}
