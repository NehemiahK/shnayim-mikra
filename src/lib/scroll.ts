/**
 * Deciding *whether* to scroll, kept separate from actually scrolling.
 *
 * The rule that makes auto-scroll tolerable is that it should almost never
 * fire. Reading down a verse, the thing you need to see next is already on
 * screen, so the page must stay perfectly still; only when the next reading
 * would be off-screen (or jammed under the sticky header) is moving the
 * viewport the helpful thing to do.
 */

export interface Bounds {
  top: number;
  bottom: number;
}

export interface ElementBox {
  top: number;
  bottom: number;
  height: number;
}

/**
 * How far the page must scroll to bring `box` into the comfortable band, or
 * `0` when it is already there and nothing should move.
 *
 * A positive result scrolls down, negative scrolls up — both are relative to
 * the current position, so the caller can hand this straight to `scrollBy`.
 */
export function scrollDelta(box: ElementBox, view: Bounds): number {
  const usable = view.bottom - view.top;

  if (box.height > usable) {
    // Taller than the band it would have to fit in — asking for it to sit
    // fully inside is impossible, so it counts as visible whenever it covers
    // the band. Otherwise align its top and let the reader scroll on.
    if (box.top <= view.top && box.bottom >= view.bottom) return 0;
  } else if (box.top >= view.top && box.bottom <= view.bottom) {
    return 0;
  }

  return box.top - view.top;
}

/** Space left below the header, and above the bottom edge, when scrolling. */
const TOP_GAP = 12;
const BOTTOM_GAP = 16;

/**
 * Bring an element into view if — and only if — it is not already comfortably
 * visible below the sticky header.
 */
export function revealElement(el: HTMLElement, header: HTMLElement | null): void {
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  const view: Bounds = {
    top: headerBottom + TOP_GAP,
    bottom: window.innerHeight - BOTTOM_GAP,
  };

  const rect = el.getBoundingClientRect();
  const delta = scrollDelta({ top: rect.top, bottom: rect.bottom, height: rect.height }, view);
  if (delta === 0) return;

  // Instant, not smooth, and this is load-bearing rather than a style choice.
  // A smooth scroll animates over ~300-500ms; a reader pressing faster than
  // that measures a still-moving page, computes a delta against a stale
  // position, and issues another scroll on top of the first. Measured at a
  // 120ms press rate that compounded into scrolling on 38 of 40 presses
  // instead of the intended once-per-verse. Instant lands exactly, so the
  // next measurement is always accurate no matter how fast the presses come.
  // The distances involved are one verse at a time, where the animation adds
  // little anyway.
  window.scrollBy({ top: delta, behavior: 'instant' });
}
