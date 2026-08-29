import { describe, expect, it } from 'vitest';
import { applyCombinedAliyot } from './combined.js';
import { buildReadingUnits } from './reading-units.js';
import type { ComboAliyah, ParshaText, Verse } from './types.js';

function verses(chapter: number, from: number, to: number): Verse[] {
  return Array.from({ length: to - from + 1 }, (_, i) => ({
    c: chapter,
    v: from + i,
    he: `he${String(from + i)}`,
    on: `on${String(from + i)}`,
    en: `en${String(from + i)}`,
    oe: [],
  }));
}

/** Two halves of a fictional combined week: 1:1-1:6 then 2:1-2:6. */
function halves(): [ParshaText, ParshaText] {
  const first: ParshaText = {
    slug: 'first',
    book: 'Numbers',
    nameEn: 'First',
    nameHe: 'ראשון',
    verses: verses(1, 1, 6),
    aliyot: [
      { n: 1, from: 0, to: 2, startRef: '1:1', endRef: '1:3' },
      { n: 2, from: 3, to: 5, startRef: '1:4', endRef: '1:6' },
    ],
  };
  const second: ParshaText = {
    slug: 'second',
    book: 'Numbers',
    nameEn: 'Second',
    nameHe: 'שני',
    verses: verses(2, 1, 6),
    aliyot: [
      { n: 1, from: 0, to: 2, startRef: '2:1', endRef: '2:3' },
      { n: 2, from: 3, to: 5, startRef: '2:4', endRef: '2:6' },
    ],
  };
  return [first, second];
}

/** Three aliyot, the middle one crossing from the first half into the second. */
const combined: ComboAliyah[] = [
  { n: 1, startRef: '1:1', endRef: '1:4' },
  { n: 2, startRef: '1:5', endRef: '2:2' },
  { n: 3, startRef: '2:3', endRef: '2:6' },
];

describe('applyCombinedAliyot', () => {
  it('renumbers each half against the combined divisions', () => {
    const [first, second] = applyCombinedAliyot(halves(), combined);
    expect(first?.aliyot.map((a) => a.n)).toEqual([1, 2]);
    expect(second?.aliyot.map((a) => a.n)).toEqual([2, 3]);
  });

  it('splits a boundary-spanning aliyah across both halves, keeping its number', () => {
    const [first, second] = applyCombinedAliyot(halves(), combined);

    const inFirst = first?.aliyot.find((a) => a.n === 2);
    const inSecond = second?.aliyot.find((a) => a.n === 2);
    expect(inFirst).toMatchObject({ startRef: '1:5', endRef: '1:6' });
    expect(inSecond).toMatchObject({ startRef: '2:1', endRef: '2:2' });
  });

  it('omits an aliyah entirely from the half it does not touch', () => {
    const [first, second] = applyCombinedAliyot(halves(), combined);
    expect(first?.aliyot.some((a) => a.n === 3)).toBe(false);
    expect(second?.aliyot.some((a) => a.n === 1)).toBe(false);
  });

  it('still covers every verse exactly once across both halves', () => {
    const parts = applyCombinedAliyot(halves(), combined);
    const covered = parts.flatMap((part) =>
      part.aliyot.flatMap((a) =>
        part.verses.slice(a.from, a.to + 1).map((v) => `${part.slug} ${String(v.c)}:${String(v.v)}`),
      ),
    );
    expect(covered).toHaveLength(12);
    expect(new Set(covered).size).toBe(12);
  });

  it('leaves the verses themselves untouched', () => {
    const original = halves();
    const parts = applyCombinedAliyot(original, combined);
    expect(parts[0]?.verses).toEqual(original[0].verses);
    expect(parts[1]?.verses).toEqual(original[1].verses);
  });
});

describe('grouping in the reading engine', () => {
  const options = { structure: 'verse', targum: 'onkelos', mikraRepetitions: 2 } as const;

  it('groups a boundary-spanning aliyah as one when merging', () => {
    const parts = applyCombinedAliyot(halves(), combined);
    const units = buildReadingUnits(parts, { ...options, mergeAliyotAcrossParts: true });

    const keys = [...new Set(units.map((u) => u.aliyahKey))];
    // Three aliyot, not four — the split second aliyah is a single entry.
    expect(keys).toEqual(['1', '2', '3']);
  });

  it('keeps each half separate when not merging', () => {
    const units = buildReadingUnits(halves(), options);
    const keys = [...new Set(units.map((u) => u.aliyahKey))];
    expect(keys).toEqual(['first:1', 'first:2', 'second:1', 'second:2']);
  });

  it('does not change which verses are read, only how they are grouped', () => {
    const separate = buildReadingUnits(halves(), options);
    const merged = buildReadingUnits(applyCombinedAliyot(halves(), combined), {
      ...options,
      mergeAliyotAcrossParts: true,
    });
    const versesOf = (us: typeof separate): string[] =>
      us.flatMap((u) => u.verses.map((i) => `${u.slug}:${String(i)}`));
    expect(versesOf(merged).sort()).toEqual(versesOf(separate).sort());
  });
});
