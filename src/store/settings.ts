import { create } from 'zustand';
import { readJson, writeJson } from '../lib/storage.js';
import type { HebrewStyle } from '../lib/hebrew.js';
import type { ReadingStructure, TargumSource } from '../lib/reading-units.js';
import type { Region } from '../lib/calendar.js';

export type Theme = 'light' | 'dark' | 'system';
export type UiLang = 'en' | 'he';

export interface Settings {
  // What counts as a reading
  structure: ReadingStructure;
  targum: TargumSource;
  mikraRepetitions: number;
  /** When the chosen third reading is Rashi and a verse has none, read Targum there instead. */
  rashiFallbackToOnkelos: boolean;
  // How the text looks
  hebrewStyle: HebrewStyle;
  fontScale: number;
  showTranslation: boolean;
  /** Whether Rashi's English starts expanded. The accordion is always there. */
  rashiEnglish: boolean;
  parallel: boolean;
  theme: Theme;
  // Who is reading
  region: Region;
  uiLang: UiLang;
}

export const DEFAULT_SETTINGS: Settings = {
  structure: 'verse',
  targum: 'onkelos',
  mikraRepetitions: 2,
  rashiFallbackToOnkelos: true,
  hebrewStyle: 'taamim',
  fontScale: 1,
  showTranslation: false,
  rashiEnglish: false,
  parallel: false,
  theme: 'system',
  region: 'diaspora',
  uiLang: 'en',
};

const KEY = 'sm:settings:v1';
export const FONT_SCALE_RANGE = { min: 0.85, max: 1.8, step: 0.05 } as const;

/** Unknown or out-of-range stored values fall back rather than breaking the UI. */
function coerce(raw: unknown): Settings {
  const v = (raw ?? {}) as Partial<Settings>;
  const pick = <K extends keyof Settings>(key: K, allowed: readonly Settings[K][]): Settings[K] =>
    allowed.includes(v[key] as Settings[K]) ? (v[key] as Settings[K]) : DEFAULT_SETTINGS[key];

  const scale = typeof v.fontScale === 'number' && Number.isFinite(v.fontScale) ? v.fontScale : 1;
  const reps = typeof v.mikraRepetitions === 'number' ? Math.trunc(v.mikraRepetitions) : 2;

  return {
    structure: pick('structure', ['verse', 'aliyah']),
    targum: pick('targum', ['onkelos', 'rashi', 'both']),
    mikraRepetitions: Math.min(3, Math.max(1, reps)),
    rashiFallbackToOnkelos:
      typeof v.rashiFallbackToOnkelos === 'boolean' ? v.rashiFallbackToOnkelos : true,
    hebrewStyle: pick('hebrewStyle', ['taamim', 'nikud', 'plain']),
    fontScale: Math.min(FONT_SCALE_RANGE.max, Math.max(FONT_SCALE_RANGE.min, scale)),
    showTranslation: typeof v.showTranslation === 'boolean' ? v.showTranslation : false,
    rashiEnglish: typeof v.rashiEnglish === 'boolean' ? v.rashiEnglish : false,
    parallel: typeof v.parallel === 'boolean' ? v.parallel : false,
    theme: pick('theme', ['light', 'dark', 'system']),
    region: pick('region', ['diaspora', 'israel']),
    uiLang: pick('uiLang', ['en', 'he']),
  };
}

interface SettingsStore {
  settings: Settings;
  set<K extends keyof Settings>(key: K, value: Settings[K]): void;
  reset(): void;
}

export const useSettings = create<SettingsStore>((set) => ({
  settings: coerce(readJson<unknown>(KEY, {})),
  set: (key, value) =>
    set((state) => {
      const settings = coerce({ ...state.settings, [key]: value });
      writeJson(KEY, settings);
      return { settings };
    }),
  reset: () => {
    writeJson(KEY, DEFAULT_SETTINGS);
    return set({ settings: DEFAULT_SETTINGS });
  },
}));

/** Exposed for tests, which need a clean store per case. */
export function __resetSettingsForTest(): void {
  useSettings.setState({ settings: DEFAULT_SETTINGS });
}
