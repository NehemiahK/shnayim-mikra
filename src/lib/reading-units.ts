import type { ParshaText, Verse } from './types.js';

/**
 * Which text satisfies the "echad targum" — the third reading.
 * The Rema permits Rashi in place of Onkelos, and some are careful to do both.
 */
export type TargumSource = 'onkelos' | 'rashi' | 'both';

/** How the reading is chunked. `verse` interleaves; `aliyah` reads in blocks. */
export type ReadingStructure = 'verse' | 'aliyah';

export interface ReadingOptions {
  structure: ReadingStructure;
  targum: TargumSource;
  /** How many times the Hebrew is read. Two by definition, but configurable. */
  mikraRepetitions: number;
}

export const DEFAULT_READING_OPTIONS: ReadingOptions = {
  structure: 'verse',
  targum: 'onkelos',
  mikraRepetitions: 2,
};

export type StepKind = 'mikra' | 'onkelos' | 'rashi';

export interface ReadingStep {
  /** Stable across sessions and settings changes — the progress key. */
  id: string;
  kind: StepKind;
  /** 1-based pass number; only meaningful for `mikra`. */
  pass: number;
}

export interface ReadingUnit {
  id: string;
  /** Slug of the parsha this unit belongs to (matters for double parshiyot). */
  slug: string;
  /** 1-based aliyah number within that parsha. */
  aliyah: number;
  /** Indices into that parsha's `verses`. One for verse units, many for blocks. */
  verses: number[];
  steps: ReadingStep[];
}

function targumKinds(targum: TargumSource): StepKind[] {
  switch (targum) {
    case 'onkelos':
      return ['onkelos'];
    case 'rashi':
      return ['rashi'];
    case 'both':
      return ['onkelos', 'rashi'];
  }
}

/**
 * Step ids embed the verse (or aliyah) and the kind, never the layout, so a
 * reader can switch between verse-by-verse and aliyah blocks mid-parsha without
 * losing progress on what they have already read.
 */
function verseStepId(slug: string, verse: Verse, kind: StepKind, pass: number): string {
  return `${slug}:${String(verse.c)}:${String(verse.v)}:${kind}${kind === 'mikra' ? String(pass) : ''}`;
}

function aliyahStepId(slug: string, aliyah: number, kind: StepKind, pass: number): string {
  return `${slug}:a${String(aliyah)}:${kind}${kind === 'mikra' ? String(pass) : ''}`;
}

function buildForParsha(parsha: ParshaText, options: ReadingOptions): ReadingUnit[] {
  const { slug, verses, aliyot } = parsha;
  const repetitions = Math.max(1, Math.trunc(options.mikraRepetitions));
  const targums = targumKinds(options.targum);
  const units: ReadingUnit[] = [];

  for (const aliyah of aliyot) {
    const indices: number[] = [];
    for (let i = aliyah.from; i <= aliyah.to; i++) indices.push(i);

    if (options.structure === 'verse') {
      for (const index of indices) {
        const verse = verses[index];
        if (!verse) continue;
        const steps: ReadingStep[] = [];
        for (let pass = 1; pass <= repetitions; pass++) {
          steps.push({ id: verseStepId(slug, verse, 'mikra', pass), kind: 'mikra', pass });
        }
        for (const kind of targums) {
          steps.push({ id: verseStepId(slug, verse, kind, 1), kind, pass: 1 });
        }
        units.push({
          id: `${slug}:${String(verse.c)}:${String(verse.v)}`,
          slug,
          aliyah: aliyah.n,
          verses: [index],
          steps,
        });
      }
    } else {
      for (let pass = 1; pass <= repetitions; pass++) {
        units.push({
          id: `${slug}:a${String(aliyah.n)}:mikra${String(pass)}`,
          slug,
          aliyah: aliyah.n,
          verses: indices,
          steps: [{ id: aliyahStepId(slug, aliyah.n, 'mikra', pass), kind: 'mikra', pass }],
        });
      }
      for (const kind of targums) {
        units.push({
          id: `${slug}:a${String(aliyah.n)}:${kind}`,
          slug,
          aliyah: aliyah.n,
          verses: indices,
          steps: [{ id: aliyahStepId(slug, aliyah.n, kind, 1), kind, pass: 1 }],
        });
      }
    }
  }

  return units;
}

/**
 * Expand one or more parshiyot (two, for a combined week) into the ordered
 * stream of readings. Pure and total — the single place the halachic
 * customization options take effect.
 */
export function buildReadingUnits(
  parts: readonly ParshaText[],
  options: ReadingOptions = DEFAULT_READING_OPTIONS,
): ReadingUnit[] {
  return parts.flatMap((parsha) => buildForParsha(parsha, options));
}

/** Every step id in reading order — the denominator for progress. */
export function allStepIds(units: readonly ReadingUnit[]): string[] {
  return units.flatMap((u) => u.steps.map((s) => s.id));
}

export interface ProgressSummary {
  done: number;
  total: number;
  /** 0-1. `1` exactly when every step is complete. */
  fraction: number;
}

export function summarize(
  units: readonly ReadingUnit[],
  isDone: (stepId: string) => boolean,
): ProgressSummary {
  let done = 0;
  let total = 0;
  for (const unit of units) {
    for (const step of unit.steps) {
      total++;
      if (isDone(step.id)) done++;
    }
  }
  return { done, total, fraction: total === 0 ? 0 : done / total };
}

/** Per-aliyah progress, for the aliyah navigator. */
export function summarizeByAliyah(
  units: readonly ReadingUnit[],
  isDone: (stepId: string) => boolean,
): Map<string, ProgressSummary> {
  const groups = new Map<string, ReadingUnit[]>();
  for (const unit of units) {
    const key = `${unit.slug}:${String(unit.aliyah)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(unit);
    else groups.set(key, [unit]);
  }
  const out = new Map<string, ProgressSummary>();
  for (const [key, group] of groups) out.set(key, summarize(group, isDone));
  return out;
}

/** The first step not yet done — where "resume" and auto-advance jump to. */
export function nextIncomplete(
  units: readonly ReadingUnit[],
  isDone: (stepId: string) => boolean,
): { unit: ReadingUnit; step: ReadingStep } | undefined {
  for (const unit of units) {
    for (const step of unit.steps) {
      if (!isDone(step.id)) return { unit, step };
    }
  }
  return undefined;
}
