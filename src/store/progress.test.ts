import { beforeEach, describe, expect, it } from 'vitest';
import { __resetProgressForTest, mostRecentUnfinished, useProgress, type SummaryMap } from './progress.js';
import { clearMemory } from '../lib/storage.js';

const store = () => useProgress.getState();

beforeEach(() => {
  clearMemory();
  globalThis.localStorage.clear();
  __resetProgressForTest();
});

describe('progress store', () => {
  it('ignores marks until a reading is open', () => {
    store().toggle('a:1:1:mikra1');
    expect(store().done.size).toBe(0);
  });

  it('toggles a step on and off', () => {
    store().open('bereshit');
    store().toggle('bereshit:1:1:mikra1');
    expect(store().done.has('bereshit:1:1:mikra1')).toBe(true);
    store().toggle('bereshit:1:1:mikra1');
    expect(store().done.has('bereshit:1:1:mikra1')).toBe(false);
  });

  it('marks and clears many steps at once', () => {
    store().open('bereshit');
    const ids = ['a', 'b', 'c'];
    store().setDone(ids, true);
    expect(store().done.size).toBe(3);
    store().setDone(['a', 'b'], false);
    expect([...store().done]).toEqual(['c']);
  });

  it('persists across a reload of the same reading', () => {
    store().open('bereshit');
    store().setDone(['bereshit:1:1:mikra1'], true);

    __resetProgressForTest();
    store().open('bereshit');
    expect(store().done.has('bereshit:1:1:mikra1')).toBe(true);
  });

  it('keeps readings independent', () => {
    store().open('bereshit');
    store().setDone(['bereshit:1:1:mikra1'], true);
    store().open('noach');
    expect(store().done.size).toBe(0);

    store().setDone(['noach:6:9:mikra1'], true);
    store().open('bereshit');
    expect([...store().done]).toEqual(['bereshit:1:1:mikra1']);
  });

  it('records a summary for the home screen', () => {
    store().open('bereshit');
    store().setDone(['x', 'y'], true);
    store().syncSummary(10);
    expect(store().summaries['bereshit']).toMatchObject({ done: 2, total: 10 });
  });

  it('clears a reading and its summary on reset', () => {
    store().open('bereshit');
    store().setDone(['x'], true);
    store().syncSummary(10);
    store().resetReading('bereshit');

    expect(store().done.size).toBe(0);
    expect(store().summaries['bereshit']).toBeUndefined();

    __resetProgressForTest();
    store().open('bereshit');
    expect(store().done.size).toBe(0);
  });

  it('survives localStorage being unavailable', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied');
      },
    });
    try {
      store().open('bereshit');
      store().toggle('bereshit:1:1:mikra1');
      expect(store().done.has('bereshit:1:1:mikra1')).toBe(true);
    } finally {
      if (original) Object.defineProperty(globalThis, 'localStorage', original);
    }
  });
});

describe('mostRecentUnfinished', () => {
  it('picks the latest reading that is still in progress', () => {
    const summaries: SummaryMap = {
      bereshit: { done: 10, total: 10, at: 3 },
      noach: { done: 2, total: 10, at: 2 },
      'lech-lecha': { done: 5, total: 10, at: 5 },
    };
    expect(mostRecentUnfinished(summaries)).toBe('lech-lecha');
  });

  it('returns undefined when everything is finished', () => {
    expect(mostRecentUnfinished({ bereshit: { done: 3, total: 3, at: 1 } })).toBeUndefined();
    expect(mostRecentUnfinished({})).toBeUndefined();
  });
});
