import { describe, expect, it } from 'vitest';
import { scrollDelta, type Bounds, type ElementBox } from './scroll.js';

/** A comfortable band running from just under a header to near the bottom. */
const view: Bounds = { top: 150, bottom: 800 };

const box = (top: number, height: number): ElementBox => ({
  top,
  bottom: top + height,
  height,
});

describe('scrollDelta', () => {
  it('does not move anything already comfortably in view', () => {
    expect(scrollDelta(box(200, 300), view)).toBe(0);
  });

  it('treats an element flush against both edges of the band as visible', () => {
    expect(scrollDelta(box(150, 650), view)).toBe(0);
  });

  it('scrolls down for an element below the fold', () => {
    // 300px tall, starting past the bottom edge.
    expect(scrollDelta(box(900, 300), view)).toBe(750);
  });

  it('scrolls up for an element above the band', () => {
    expect(scrollDelta(box(20, 100), view)).toBe(-130);
  });

  it('scrolls an element hidden behind the sticky header back into the open', () => {
    // Top edge above the band means it is under the header, even though most
    // of it is technically on screen.
    expect(scrollDelta(box(100, 300), view)).toBe(-50);
  });

  it('scrolls up an element only partly cut off at the bottom', () => {
    // Bottom overhangs by 100px, so it should move by exactly that much less
    // — aligning its top to the band.
    expect(scrollDelta(box(600, 300), view)).toBe(450);
  });

  describe('elements taller than the visible band', () => {
    const tall = 900; // band is only 650

    it('leaves one alone while it covers the whole band', () => {
      expect(scrollDelta(box(100, tall), view)).toBe(0);
      expect(scrollDelta(box(-100, tall), view)).toBe(0);
    });

    it('aligns its top once it has scrolled past', () => {
      // Its bottom is now above the band's bottom, so there is empty space.
      expect(scrollDelta(box(-400, tall), view)).toBe(-550);
    });

    it('aligns its top when arriving at it from above', () => {
      expect(scrollDelta(box(700, tall), view)).toBe(550);
    });
  });

  it('never returns a delta that would overshoot its own target', () => {
    // Whatever the case, applying the delta must land the top at view.top.
    for (const [top, height] of [
      [900, 300],
      [20, 100],
      [-400, 900],
      [700, 900],
    ] as const) {
      const delta = scrollDelta(box(top, height), view);
      if (delta !== 0) expect(top - delta).toBe(view.top);
    }
  });
});
