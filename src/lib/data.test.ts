import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadParsha, parshaUrl, rashiUrl } from './data.js';
import { PARSHA_DATA_VERSION, RASHI_DATA_VERSION } from './data-version.js';

/** A verse as it was shaped before `oe` (the Targum in English) existed. */
const staleVerse = {
  c: 1,
  v: 1,
  he: 'בְּרֵאשִׁית',
  on: 'בְּקַדְמִין',
  en: 'In the beginning',
};

function respondWith(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('payload urls', () => {
  it('request the version the build writes', () => {
    expect(parshaUrl('bereshit')).toContain(`bereshit.${PARSHA_DATA_VERSION}.json`);
    expect(rashiUrl('bereshit')).toContain(`bereshit.${RASHI_DATA_VERSION}.json`);
  });
});

describe('loading a payload older than the current code', () => {
  // /data is immutable for a year and CacheFirst in the service worker, so a
  // stale payload can outlive a deploy. Bumping the version is the real fix;
  // this is the seatbelt, because losing one translation is recoverable and a
  // blank screen is not.
  it('backfills a missing per-verse field instead of throwing', async () => {
    respondWith({
      slug: 'stale',
      book: 'Genesis',
      nameEn: 'Stale',
      nameHe: 'ישן',
      aliyot: [{ n: 1, from: 0, to: 0, startRef: '1:1', endRef: '1:1' }],
      verses: [staleVerse],
    });

    const parsha = await loadParsha('stale-backfill');
    // The crash was `Cannot read properties of undefined (reading 'length')`
    // on exactly this field while rendering.
    expect(parsha.verses[0]?.oe).toEqual([]);
    expect(parsha.verses[0]?.oe.length).toBe(0);
  });

  it('keeps the field when it is present', async () => {
    respondWith({
      slug: 'fresh',
      book: 'Genesis',
      nameEn: 'Fresh',
      nameHe: 'חדש',
      aliyot: [{ n: 1, from: 0, to: 0, startRef: '1:1', endRef: '1:1' }],
      verses: [{ ...staleVerse, oe: [{ t: 'In the beginning' }, { t: 'created', b: true }] }],
    });

    const parsha = await loadParsha('fresh-keep');
    expect(parsha.verses[0]?.oe).toHaveLength(2);
    expect(parsha.verses[0]?.oe[1]).toMatchObject({ b: true });
  });

  it('still rejects a payload with nothing usable in it', async () => {
    respondWith({ slug: 'broken', verses: [], aliyot: [] });
    await expect(loadParsha('broken-reject')).rejects.toThrow(/Malformed parsha data/u);
  });
});
