import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings, useSettings, __resetSettingsForTest } from './settings.js';
import { clearMemory } from '../lib/storage.js';

beforeEach(() => {
  clearMemory();
  globalThis.localStorage.clear();
  __resetSettingsForTest();
});

describe('translation placement', () => {
  it('defaults to off for a first-time reader', () => {
    expect(DEFAULT_SETTINGS.translation).toBe('off');
    expect(parseSettings({}).translation).toBe('off');
  });

  it('accepts each placement', () => {
    for (const value of ['off', 'after', 'end'] as const) {
      expect(parseSettings({ translation: value }).translation).toBe(value);
    }
  });

  it('falls back on a nonsense stored value', () => {
    expect(parseSettings({ translation: 'sideways' }).translation).toBe('off');
    expect(parseSettings({ translation: 42 }).translation).toBe('off');
  });

  it('round-trips through the store', () => {
    useSettings.getState().set('translation', 'after');
    expect(useSettings.getState().settings.translation).toBe('after');

    const stored = JSON.parse(globalThis.localStorage.getItem('sm:settings:v1') ?? '{}') as {
      translation?: string;
    };
    expect(stored.translation).toBe('after');
  });
});

describe('upgrading from the old showTranslation boolean', () => {
  // This setting used to be a boolean. A stored `true` matches none of the new
  // values, so without an explicit migration it would fall through to the
  // default and silently switch translations off for anyone who had them on.
  it('keeps translations visible for someone who had them enabled', () => {
    expect(parseSettings({ showTranslation: true }).translation).toBe('end');
  });

  it('leaves them off for someone who had them disabled', () => {
    expect(parseSettings({ showTranslation: false }).translation).toBe('off');
  });

  it('prefers an explicit new value over the stale boolean', () => {
    expect(parseSettings({ showTranslation: true, translation: 'after' }).translation).toBe('after');
  });

  it('does not carry the retired key forward', () => {
    const settings = parseSettings({ showTranslation: true });
    expect(settings).not.toHaveProperty('showTranslation');
  });
});

describe('coercion generally', () => {
  it('survives a completely empty or malformed store', () => {
    for (const raw of [{}, null, undefined, 'nonsense', 42]) {
      expect(() => parseSettings(raw)).not.toThrow();
    }
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values it does not need to touch', () => {
    const settings = parseSettings({ targum: 'both', hebrewStyle: 'plain', uiLang: 'he' });
    expect(settings.targum).toBe('both');
    expect(settings.hebrewStyle).toBe('plain');
    expect(settings.uiLang).toBe('he');
  });
});
