import { create } from 'zustand';
import { readJson, writeJson, removeRaw } from '../lib/storage.js';

/**
 * Progress is stored one key per reading (`sm:progress:v1:<slug>`) rather than
 * as one blob, so marking a verse only ever re-serializes the few hundred ids
 * of the parsha in hand — not every step the reader has ever completed.
 */
const progressKey = (slug: string): string => `sm:progress:v1:${slug}`;
const SUMMARY_KEY = 'sm:summary:v1';

export interface ReadingSummary {
  done: number;
  total: number;
  /** Epoch ms, for "continue where you left off". */
  at: number;
}

export type SummaryMap = Record<string, ReadingSummary>;

interface ProgressStore {
  /** Route slug of the reading currently loaded. */
  slug: string | null;
  done: ReadonlySet<string>;
  summaries: SummaryMap;

  open(slug: string): void;
  toggle(stepId: string): void;
  setDone(stepIds: readonly string[], value: boolean): void;
  resetReading(slug: string): void;
  /** Records done/total for the home screen without loading the text. */
  syncSummary(total: number): void;
}

function loadDone(slug: string): Set<string> {
  return new Set(readJson<string[]>(progressKey(slug), []));
}

function persist(slug: string, done: ReadonlySet<string>): void {
  writeJson(progressKey(slug), [...done]);
}

function persistSummaries(summaries: SummaryMap): void {
  writeJson(SUMMARY_KEY, summaries);
}

export const useProgress = create<ProgressStore>((set, get) => ({
  slug: null,
  done: new Set<string>(),
  summaries: readJson<SummaryMap>(SUMMARY_KEY, {}),

  open: (slug) => {
    if (get().slug === slug) return;
    set({ slug, done: loadDone(slug) });
  },

  toggle: (stepId) =>
    set((state) => {
      if (!state.slug) return state;
      const done = new Set(state.done);
      if (done.has(stepId)) done.delete(stepId);
      else done.add(stepId);
      persist(state.slug, done);
      return { done };
    }),

  setDone: (stepIds, value) =>
    set((state) => {
      if (!state.slug) return state;
      const done = new Set(state.done);
      for (const id of stepIds) {
        if (value) done.add(id);
        else done.delete(id);
      }
      persist(state.slug, done);
      return { done };
    }),

  resetReading: (slug) =>
    set((state) => {
      removeRaw(progressKey(slug));
      const summaries = { ...state.summaries };
      delete summaries[slug];
      persistSummaries(summaries);
      return {
        summaries,
        ...(state.slug === slug ? { done: new Set<string>() } : {}),
      };
    }),

  syncSummary: (total) =>
    set((state) => {
      if (!state.slug) return state;
      const entry: ReadingSummary = { done: state.done.size, total, at: Date.now() };
      const existing = state.summaries[state.slug];
      if (existing && existing.done === entry.done && existing.total === entry.total) return state;
      const summaries = { ...state.summaries, [state.slug]: entry };
      persistSummaries(summaries);
      return { summaries };
    }),
}));

/** The most recently touched, unfinished reading — powers "continue reading". */
export function mostRecentUnfinished(summaries: SummaryMap): string | undefined {
  let best: { slug: string; at: number } | undefined;
  for (const [slug, s] of Object.entries(summaries)) {
    if (s.total === 0 || s.done >= s.total) continue;
    if (!best || s.at > best.at) best = { slug, at: s.at };
  }
  return best?.slug;
}

export function __resetProgressForTest(): void {
  useProgress.setState({ slug: null, done: new Set<string>(), summaries: {} });
}
