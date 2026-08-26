import { describe, expect, it } from 'vitest';
import { DICTIONARIES, isRtl, translator } from './i18n.js';

describe('dictionaries', () => {
  it('define exactly the same keys in every language', () => {
    const [first, ...rest] = Object.values(DICTIONARIES).map((d) => Object.keys(d).sort());
    expect(first).toBeDefined();
    for (const keys of rest) expect(keys).toEqual(first);
  });

  it('has no empty strings', () => {
    for (const [lang, dict] of Object.entries(DICTIONARIES)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('translates and reports direction', () => {
    expect(translator('en')('mikra')).toBe('Mikra');
    expect(translator('he')('mikra')).toBe('מקרא');
    expect(isRtl('he')).toBe(true);
    expect(isRtl('en')).toBe(false);
  });
});
