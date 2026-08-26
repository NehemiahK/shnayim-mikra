import { describe, expect, it } from 'vitest';
import {
  compareAddress,
  formatRange,
  isWithin,
  normalizeName,
  parseRef,
  toSlug,
  verseKey,
} from './refs.js';

describe('parseRef', () => {
  it.each([
    ['Genesis 1:1', { book: 'Genesis', start: { c: 1, v: 1 }, end: { c: 1, v: 1 } }],
    ['Genesis 2:4-19', { book: 'Genesis', start: { c: 2, v: 4 }, end: { c: 2, v: 19 } }],
    ['Genesis 1:1-6:8', { book: 'Genesis', start: { c: 1, v: 1 }, end: { c: 6, v: 8 } }],
    // Sefaria mixes dash characters; Deuteronomy 33 uses an en dash.
    ['Deuteronomy 33:1–7', { book: 'Deuteronomy', start: { c: 33, v: 1 }, end: { c: 33, v: 7 } }],
    ['Leviticus 16:1—17:9', { book: 'Leviticus', start: { c: 16, v: 1 }, end: { c: 17, v: 9 } }],
    // Multi-word book names must not be greedily eaten by the chapter group.
    ['I Samuel 26:1-5', { book: 'I Samuel', start: { c: 26, v: 1 }, end: { c: 26, v: 5 } }],
  ])('parses %s', (input, expected) => {
    expect(parseRef(input)).toEqual(expected);
  });

  it.each(['', 'Genesis', 'Genesis 1', 'not a ref', '1:1'])('rejects %o', (bad) => {
    expect(() => parseRef(bad)).toThrow(/Unparseable ref/u);
  });
});

describe('address helpers', () => {
  it('orders by chapter then verse', () => {
    expect(compareAddress({ c: 1, v: 5 }, { c: 2, v: 1 })).toBeLessThan(0);
    expect(compareAddress({ c: 2, v: 5 }, { c: 2, v: 1 })).toBeGreaterThan(0);
    expect(compareAddress({ c: 3, v: 3 }, { c: 3, v: 3 })).toBe(0);
  });

  it('tests range membership inclusively', () => {
    const range = parseRef('Genesis 1:1-6:8');
    expect(isWithin({ c: 1, v: 1 }, range)).toBe(true);
    expect(isWithin({ c: 6, v: 8 }, range)).toBe(true);
    expect(isWithin({ c: 3, v: 20 }, range)).toBe(true);
    expect(isWithin({ c: 6, v: 9 }, range)).toBe(false);
  });

  it('formats ranges compactly', () => {
    expect(formatRange({ c: 1, v: 1 }, { c: 6, v: 8 })).toBe('1:1-6:8');
    expect(formatRange({ c: 5, v: 2 }, { c: 5, v: 9 })).toBe('5:2-9');
    expect(formatRange({ c: 5, v: 2 }, { c: 5, v: 2 })).toBe('5:2');
  });

  it('builds verse keys', () => {
    expect(verseKey(12, 3)).toBe('12:3');
  });
});

describe('name handling', () => {
  it.each([
    ['Bereshit', 'bereshit'],
    ['Lech Lecha', 'lech-lecha'],
    ["Sh'lach", 'shlach'],
    ['Achrei Mot', 'achrei-mot'],
    ["Ha'azinu", 'haazinu'],
  ])('slugs %s', (name, slug) => {
    expect(toSlug(name)).toBe(slug);
  });

  it('matches the same parsha across differing source spellings', () => {
    expect(normalizeName('Lech-Lecha')).toBe(normalizeName('Lech Lecha'));
    expect(normalizeName("Sh'lach")).toBe(normalizeName('Shlach'));
    expect(normalizeName("Ha'azinu")).toBe(normalizeName('Haazinu'));
    expect(normalizeName('Bereshit')).not.toBe(normalizeName('Bereishit2'));
  });
});
