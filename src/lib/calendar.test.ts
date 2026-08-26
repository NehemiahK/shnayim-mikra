import { describe, expect, it } from 'vitest';
import {
  COMBOS,
  PARSHIYOT,
  parshaMeta,
  readingForDate,
  readingOrder,
  resolveParsha,
  shabbatFor,
  toIsoDate,
  upcomingReadings,
} from './calendar.js';

const d = (iso: string): Date => {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, day ?? 1);
};

describe('shabbatFor', () => {
  it('returns the coming Saturday from a weekday', () => {
    expect(toIsoDate(shabbatFor(d('2026-08-26')))).toBe('2026-08-29'); // Wednesday
    expect(toIsoDate(shabbatFor(d('2026-08-30')))).toBe('2026-09-05'); // Sunday
  });

  it('returns the same day when it is already Shabbat', () => {
    expect(toIsoDate(shabbatFor(d('2026-08-29')))).toBe('2026-08-29');
  });

  it('always lands on a Saturday', () => {
    for (let i = 0; i < 40; i++) {
      const date = d('2026-01-01');
      date.setDate(date.getDate() + i * 9);
      expect(shabbatFor(date).getDay()).toBe(6);
    }
  });
});

describe('readingForDate', () => {
  // Cross-checked against Sefaria's live calendar API at build time.
  it('finds the parsha for a known week', () => {
    const reading = readingForDate(d('2026-08-26'), 'diaspora');
    expect(reading?.slug).toBe('ki-tavo');
    expect(toIsoDate(reading?.shabbat ?? new Date(0))).toBe('2026-08-29');
    expect(reading?.isUpcoming).toBe(false);
  });

  it('resolves a combined week to its combo slug', () => {
    expect(readingForDate(d('2026-09-05'), 'diaspora')?.slug).toBe('nitzavim-vayeilech');
  });

  it('restarts the cycle at Bereshit', () => {
    expect(readingForDate(d('2026-10-10'), 'diaspora')?.slug).toBe('bereshit');
  });

  it('skips ahead when a festival displaces the weekly reading', () => {
    // Sukkot 2026 falls across the Shabbat of 2026-09-26.
    const reading = readingForDate(d('2026-09-26'), 'diaspora');
    expect(reading).toBeDefined();
    expect(reading?.isUpcoming).toBe(true);
    expect(reading?.shabbat.getTime()).toBeGreaterThan(d('2026-09-26').getTime());
  });

  it('returns a reading for every week across several years', () => {
    const date = d('2027-01-02');
    for (let i = 0; i < 200; i++) {
      expect(readingForDate(date, 'diaspora'), toIsoDate(date)).toBeDefined();
      expect(readingForDate(date, 'israel'), toIsoDate(date)).toBeDefined();
      date.setDate(date.getDate() + 7);
    }
  });

  it('returns undefined before the table begins', () => {
    expect(readingForDate(d('2010-01-01'), 'diaspora')).toBeUndefined();
  });
});

describe('resolveParsha', () => {
  it('resolves a single parsha to one part', () => {
    const r = resolveParsha('bereshit');
    expect(r).toMatchObject({ slug: 'bereshit', parts: ['bereshit'], isCombo: false });
    expect(r?.nameHe.length).toBeGreaterThan(0);
  });

  it('resolves a combo to both halves in order', () => {
    const r = resolveParsha('matot-masei');
    expect(r?.isCombo).toBe(true);
    expect(r?.parts).toEqual(['matot', 'masei']);
  });

  it('returns undefined for nonsense', () => {
    expect(resolveParsha('not-a-parsha')).toBeUndefined();
  });

  it('resolves every scheduled slug the calendar can produce', () => {
    for (const combo of COMBOS) expect(resolveParsha(combo.slug)).toBeDefined();
    for (const p of PARSHIYOT) expect(resolveParsha(p.slug)).toBeDefined();
  });
});

describe('index metadata', () => {
  it('exposes all 54 parshiyot with unique slugs and orders', () => {
    expect(PARSHIYOT).toHaveLength(54);
    expect(new Set(PARSHIYOT.map((p) => p.slug)).size).toBe(54);
    expect([...PARSHIYOT].map((p) => p.order).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 54 }, (_, i) => i + 1),
    );
  });

  it('sorts combos with their first half', () => {
    const matot = parshaMeta('matot')?.order ?? 0;
    expect(readingOrder('matot-masei')).toBe(matot);
    expect(readingOrder('nonsense')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('upcomingReadings', () => {
  it('lists consecutive future readings without repeating', () => {
    const list = upcomingReadings(d('2026-08-26'), 'diaspora', 5);
    expect(list).toHaveLength(5);
    expect(list[0]?.slug).toBe('ki-tavo');
    expect(new Set(list.map((r) => r.slug)).size).toBe(5);
  });
});
