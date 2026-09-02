import { create } from 'zustand';
import { readJson, writeJson } from '../lib/storage.js';
import type { HebrewStyle } from '../lib/hebrew.js';
import type { ReadingStructure, TargumSource } from '../lib/reading-units.js';
import type { Region } from '../lib/calendar.js';

export type Theme = 'light' | 'dark' | 'system';
/** `combined` follows how the week is actually read; `separate` keeps each parsha's own seven. */
export type DoubleParshaMode = 'combined' | 'separate';
/** Where the English translation sits under a verse being read. */
export type TranslationPlacement = 'off' | 'after' | 'end';
export type UiLang = 'en' | 'he';

export interface Settings {
  // What counts as a reading
  structure: ReadingStructure;
  targum: TargumSource;
  mikraRepetitions: number;
  /** When the chosen third reading is Rashi and a verse has none, read Targum there instead. */
  rashiFallbackToOnkelos: boolean;
  /** How a week that reads two parshiyot together is divided into aliyot. */
  doubleParsha: DoubleParshaMode;
  // How the text looks
  hebrewStyle: HebrewStyle;
  fontScale: number;
  /**
   * `after` puts the English straight under the Hebrew, before the Targum;
   * `end` puts it below the whole verse. Either way it is always available by
   * expanding a verse, so `off` only hides the inline copy.
   */
  translation: TranslationPlacement;
  /** Whether Rashi's English starts expanded. The accordion is always there. */
  rashiEnglish: boolean;
  /** Whether the Targum's English starts expanded. */
  onkelosEnglish: boolean;
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
  doubleParsha: 'combined',
  hebrewStyle: 'taamim',
  fontScale: 1,
  translation: 'off',
  rashiEnglish: false,
  onkelosEnglish: false,
  parallel: false,
  theme: 'system',
  region: 'diaspora',
  uiLang: 'en',
};

const KEY = 'sm:settings:v1';
export const FONT_SCALE_RANGE = { min: 0.85, max: 1.8, step: 0.05 } as const;

/**
 * Reads the translation placement, upgrading the boolean this setting used to
 * be. Without this, an existing reader who had translations on would find them
 * silently switched off, since a stored `true` matches none of the new values.
 */
function migrateTranslation(raw: unknown): TranslationPlacement {
  const v = (raw ?? {}) as { translation?: unknown; showTranslation?: unknown };
  if (v.translation === 'off' || v.translation === 'after' || v.translation === 'end') {
    return v.translation;
  }
  if (typeof v.showTranslation === 'boolean') return v.showTranslation ? 'end' : 'off';
  return 'off';
}

/**
 * Turn whatever is in storage into valid settings. Unknown or out-of-range
 * values fall back rather than breaking the UI, and older shapes are migrated.
 * Exported so the upgrade paths can be tested directly.
 */
export function parseSettings(raw: unknown): Settings {
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
    doubleParsha: pick('doubleParsha', ['combined', 'separate']),
    hebrewStyle: pick('hebrewStyle', ['taamim', 'nikud', 'plain']),
    fontScale: Math.min(FONT_SCALE_RANGE.max, Math.max(FONT_SCALE_RANGE.min, scale)),
    translation: migrateTranslation(raw),
    rashiEnglish: typeof v.rashiEnglish === 'boolean' ? v.rashiEnglish : false,
    onkelosEnglish: typeof v.onkelosEnglish === 'boolean' ? v.onkelosEnglish : false,
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
  settings: parseSettings(readJson<unknown>(KEY, {})),
  set: (key, value) =>
    set((state) => {
      const settings = parseSettings({ ...state.settings, [key]: value });
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
