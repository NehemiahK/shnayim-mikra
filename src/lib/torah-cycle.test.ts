import { describe, expect, it } from 'vitest';
import { HDate, HebrewCalendar } from '@hebcal/core';
import indexData from '../data/parshiyot.json' with { type: 'json' };
import { normalizeName } from './refs.js';
import { shabbatReading, type Region } from './torah-cycle.js';
import type { ParshiyotIndex } from './types.js';

const index = indexData as ParshiyotIndex;
const slugByName = new Map(index.parshiyot.map((p) => [normalizeName(p.nameEn), p.slug]));

const iso = (d: Date): string =>
  `${String(d.getFullYear()).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** hebcal's schedule for a span of years, as ISO date → reading slug. */
function hebcalSchedule(region: Region, fromYear: number, toYear: number): Map<string, string> {
  const events = HebrewCalendar.calendar({
    start: new HDate(new Date(fromYear, 0, 1)),
    end: new HDate(new Date(toYear, 11, 31)),
    sedrot: true,
    noHolidays: true,
    il: region === 'israel',
  });
  const byDate = new Map<string, string>();
  for (const ev of events) {
    const names = (ev as { parsha?: string[] }).parsha;
    if (!names?.length) continue;
    const slugs = names.map((n) => slugByName.get(normalizeName(n)));
    if (slugs.some((s) => s === undefined)) throw new Error(`unmatched parsha ${names.join('+')}`);
    byDate.set(iso(ev.getDate().greg()), slugs.join('-'));
  }
  return byDate;
}

/**
 * hebcal is an independent implementation of the same rules, so agreeing with
 * it on every Shabbat across two centuries — both Israel and the diaspora —
 * is strong evidence the calendar arithmetic and the pairing table are right.
 */
describe.each<Region>(['diaspora', 'israel'])('shabbatReading (%s) agrees with hebcal', (region) => {
  const FROM = 1950;
  const TO = 2150;
  const expected = hebcalSchedule(region, FROM, TO);

  it('matches every Shabbat, including festival weeks, 1950–2150', () => {
    const cursor = new Date(FROM, 0, 1);
    cursor.setDate(cursor.getDate() + ((6 - cursor.getDay() + 7) % 7));
    const mismatches: string[] = [];
    let compared = 0;
    for (; cursor.getFullYear() <= TO; cursor.setDate(cursor.getDate() + 7)) {
      const want = expected.get(iso(cursor)) ?? '';
      const got = shabbatReading(cursor, region);
      compared++;
      if (got !== want) mismatches.push(`${iso(cursor)}: got "${got}", want "${want}"`);
    }
    expect(compared).toBeGreaterThan(10_000);
    expect(mismatches.slice(0, 10)).toEqual([]);
  });
});

describe('shabbatReading', () => {
  const d = (y: number, m: number, day: number): Date => new Date(y, m - 1, day);

  it('reads Bereshit on the first Shabbat after Simchat Torah', () => {
    expect(shabbatReading(d(2026, 10, 10), 'diaspora')).toBe('bereshit');
  });

  it('is blank for a festival Shabbat, and in the gap after Haazinu', () => {
    expect(shabbatReading(d(2026, 9, 19), 'diaspora')).toBe('haazinu');
    expect(shabbatReading(d(2026, 9, 26), 'diaspora')).toBe('');
    expect(shabbatReading(d(2026, 10, 3), 'diaspora')).toBe('');
  });

  it('keeps going far beyond any precomputed table', () => {
    expect(shabbatReading(d(2400, 1, 1), 'diaspora')).not.toBe('');
  });
});

describe('the shape of the reading year', () => {
  const known = new Set([...index.parshiyot.map((p) => p.slug), ...index.combos.map((c) => c.slug), '']);
  const comboParts = new Map(index.combos.map((c) => [c.slug, c.parts]));

  const shabbatot = (region: Region, from: Date, weeks: number): string[] => {
    const cursor = new Date(from);
    return Array.from({ length: weeks }, () => {
      const slug = shabbatReading(cursor, region);
      cursor.setDate(cursor.getDate() + 7);
      return slug;
    });
  };

  it('only ever names readings that exist', () => {
    for (const region of ['diaspora', 'israel'] as const) {
      for (const slug of shabbatot(region, new Date(2026, 0, 3), 52 * 30)) {
        expect(known.has(slug), `${region}: ${slug}`).toBe(true);
      }
    }
  });

  it('reads all 53 Shabbat parshiyot exactly once between one Bereshit and the next', () => {
    for (const region of ['diaspora', 'israel'] as const) {
      // Bereshit 2025-10-18 → Bereshit 2026-10-10 (52 Shabbatot, festivals included).
      const read = shabbatot(region, new Date(2025, 9, 18), 52).filter((s) => s !== '');
      const first = read.indexOf('bereshit', 1);
      const cycle = read.slice(0, first);
      const parts = cycle.flatMap((slug) => comboParts.get(slug) ?? [slug]);
      expect(new Set(parts).size, region).toBe(53);
      expect(parts.length, region).toBe(53);
    }
  });

  it("never schedules V'Zot HaBerachah, which is read on Simchat Torah", () => {
    for (const region of ['diaspora', 'israel'] as const) {
      expect(shabbatot(region, new Date(2026, 0, 3), 52 * 30)).not.toContain('vzot-haberachah');
    }
  });

  it('keeps Israel and the diaspora apart for the stretch after Pesach in some years', () => {
    const il = shabbatot('israel', new Date(2026, 0, 3), 52 * 30);
    const di = shabbatot('diaspora', new Date(2026, 0, 3), 52 * 30);
    expect(di.some((slug, i) => slug !== il[i])).toBe(true);
  });
});
