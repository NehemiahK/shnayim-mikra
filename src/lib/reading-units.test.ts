import { describe, expect, it } from 'vitest';
import {
  allStepIds,
  buildReadingUnits,
  nextIncomplete,
  summarize,
  summarizeByAliyah,
  type ReadingOptions,
  type ReadingStructure,
  type TargumSource,
} from './reading-units.js';
import type { ParshaText } from './schema.js';

/** Two aliyot: verses 1:1-1:3 and 1:4-1:5. */
function fixture(slug = 'test'): ParshaText {
  return {
    slug,
    book: 'Genesis',
    nameEn: 'Test',
    nameHe: 'ניסיון',
    aliyot: [
      { n: 1, from: 0, to: 2, startRef: '1:1', endRef: '1:3' },
      { n: 2, from: 3, to: 4, startRef: '1:4', endRef: '1:5' },
    ],
    verses: [1, 2, 3, 4, 5].map((v) => ({ c: 1, v, he: `he${String(v)}`, on: `on${String(v)}`, en: `en${String(v)}` })),
  };
}

const opts = (over: Partial<ReadingOptions> = {}): ReadingOptions => ({
  structure: 'verse',
  targum: 'onkelos',
  mikraRepetitions: 2,
  ...over,
});

describe('buildReadingUnits — verse structure', () => {
  it('emits one unit per verse with mikra twice then targum', () => {
    const units = buildReadingUnits([fixture()], opts());
    expect(units).toHaveLength(5);

    const first = units[0];
    expect(first?.id).toBe('test:1:1');
    expect(first?.aliyah).toBe(1);
    expect(first?.verses).toEqual([0]);
    expect(first?.steps.map((s) => s.kind)).toEqual(['mikra', 'mikra', 'onkelos']);
    expect(first?.steps.map((s) => s.id)).toEqual([
      'test:1:1:mikra1',
      'test:1:1:mikra2',
      'test:1:1:onkelos',
    ]);
  });

  it('keeps verses in order and assigns each to its aliyah', () => {
    const units = buildReadingUnits([fixture()], opts());
    expect(units.map((u) => u.verses[0])).toEqual([0, 1, 2, 3, 4]);
    expect(units.map((u) => u.aliyah)).toEqual([1, 1, 1, 2, 2]);
  });
});

describe('buildReadingUnits — aliyah structure', () => {
  it('emits mikra passes then targum, each covering the whole aliyah', () => {
    const units = buildReadingUnits([fixture()], opts({ structure: 'aliyah' }));
    expect(units).toHaveLength(6); // 2 aliyot x (2 mikra + 1 targum)
    expect(units.slice(0, 3).map((u) => u.id)).toEqual([
      'test:a1:mikra1',
      'test:a1:mikra2',
      'test:a1:onkelos',
    ]);
    expect(units[0]?.verses).toEqual([0, 1, 2]);
    expect(units[3]?.verses).toEqual([3, 4]);
  });
});

describe('targum source', () => {
  it.each([
    ['onkelos' as TargumSource, ['mikra', 'mikra', 'onkelos']],
    ['rashi' as TargumSource, ['mikra', 'mikra', 'rashi']],
    ['both' as TargumSource, ['mikra', 'mikra', 'onkelos', 'rashi']],
  ])('%s produces %o', (targum, kinds) => {
    const units = buildReadingUnits([fixture()], opts({ targum }));
    expect(units[0]?.steps.map((s) => s.kind)).toEqual(kinds);
  });
});

describe('mikra repetitions', () => {
  it.each([1, 2, 3])('reads the Hebrew %i time(s)', (reps) => {
    const units = buildReadingUnits([fixture()], opts({ mikraRepetitions: reps }));
    const mikra = units[0]?.steps.filter((s) => s.kind === 'mikra') ?? [];
    expect(mikra).toHaveLength(reps);
    expect(mikra.map((s) => s.pass)).toEqual(Array.from({ length: reps }, (_, i) => i + 1));
  });

  it('clamps nonsense values to at least one reading', () => {
    const units = buildReadingUnits([fixture()], opts({ mikraRepetitions: 0 }));
    expect(units[0]?.steps.filter((s) => s.kind === 'mikra')).toHaveLength(1);
  });
});

describe('invariants across every settings combination', () => {
  const structures: ReadingStructure[] = ['verse', 'aliyah'];
  const targums: TargumSource[] = ['onkelos', 'rashi', 'both'];

  for (const structure of structures) {
    for (const targum of targums) {
      for (const mikraRepetitions of [1, 2, 3]) {
        const label = `${structure}/${targum}/x${String(mikraRepetitions)}`;

        it(`${label}: step ids are unique`, () => {
          const ids = allStepIds(buildReadingUnits([fixture()], opts({ structure, targum, mikraRepetitions })));
          expect(new Set(ids).size).toBe(ids.length);
        });

        it(`${label}: every verse is covered exactly once per reading pass`, () => {
          const units = buildReadingUnits([fixture()], opts({ structure, targum, mikraRepetitions }));
          const seen = new Map<number, number>();
          for (const unit of units) {
            for (const index of unit.verses) {
              // Count only mikra-pass-1 units so each verse is counted once.
              if (unit.steps.some((s) => s.kind === 'mikra' && s.pass === 1)) {
                seen.set(index, (seen.get(index) ?? 0) + 1);
              }
            }
          }
          expect([...seen.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
          expect([...seen.values()]).toEqual([1, 1, 1, 1, 1]);
        });

        it(`${label}: mikra always precedes targum for the same verse`, () => {
          const units = buildReadingUnits([fixture()], opts({ structure, targum, mikraRepetitions }));
          const order = allStepIds(units);
          for (const unit of units) {
            for (const index of unit.verses) {
              const lastMikra = Math.max(
                ...order
                  .map((id, i) => (id.includes(':mikra') && covers(units, id, index) ? i : -1))
                  .filter((i) => i >= 0),
              );
              const firstTargum = Math.min(
                ...order
                  .map((id, i) =>
                    (id.includes(':onkelos') || id.includes(':rashi')) && covers(units, id, index) ? i : Number.MAX_SAFE_INTEGER,
                  )
                  .filter((i) => i !== Number.MAX_SAFE_INTEGER),
              );
              expect(lastMikra).toBeLessThan(firstTargum);
            }
          }
        });
      }
    }
  }
});

function covers(units: ReturnType<typeof buildReadingUnits>, stepId: string, verseIndex: number): boolean {
  return units.some((u) => u.steps.some((s) => s.id === stepId) && u.verses.includes(verseIndex));
}

describe('combined parshiyot', () => {
  it('concatenates both halves and namespaces ids by parsha', () => {
    const units = buildReadingUnits([fixture('matot'), fixture('masei')], opts());
    expect(units).toHaveLength(10);
    expect(units.slice(0, 5).every((u) => u.slug === 'matot')).toBe(true);
    expect(units.slice(5).every((u) => u.slug === 'masei')).toBe(true);
    const ids = allStepIds(units);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('progress helpers', () => {
  it('summarizes completion', () => {
    const units = buildReadingUnits([fixture()], opts());
    const ids = allStepIds(units);
    const done = new Set(ids.slice(0, 5));
    const s = summarize(units, (id) => done.has(id));
    expect(s).toEqual({ done: 5, total: 15, fraction: 5 / 15 });
  });

  it('reports fraction 1 only when everything is done', () => {
    const units = buildReadingUnits([fixture()], opts());
    const ids = allStepIds(units);
    expect(summarize(units, (id) => ids.slice(0, -1).includes(id)).fraction).toBeLessThan(1);
    expect(summarize(units, () => true).fraction).toBe(1);
  });

  it('summarizes per aliyah', () => {
    const units = buildReadingUnits([fixture()], opts());
    const byAliyah = summarizeByAliyah(units, (id) => id.startsWith('test:1:1'));
    expect(byAliyah.get('test:1')).toEqual({ done: 3, total: 9, fraction: 3 / 9 });
    expect(byAliyah.get('test:2')).toEqual({ done: 0, total: 6, fraction: 0 });
  });

  it('finds the next incomplete step', () => {
    const units = buildReadingUnits([fixture()], opts());
    const done = new Set(['test:1:1:mikra1', 'test:1:1:mikra2']);
    expect(nextIncomplete(units, (id) => done.has(id))?.step.id).toBe('test:1:1:onkelos');
    expect(nextIncomplete(units, () => true)).toBeUndefined();
  });
});
