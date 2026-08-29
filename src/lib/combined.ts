import type { Aliyah, ComboAliyah, ParshaText } from './types.js';
import { compareAddress, verseKey, type VerseAddress } from './refs.js';

function parseKey(ref: string): VerseAddress {
  const [c, v] = ref.split(':').map(Number);
  return { c: c ?? 0, v: v ?? 0 };
}

/**
 * Re-slice a combined week's parshiyot so their aliyot are the seven the
 * reading actually uses.
 *
 * Each parsha ships with its own seven aliyot, but a week that reads two
 * together is divided into seven across the pair — and those divisions are
 * genuinely different, not a concatenation. Matot-Masei's fourth aliyah runs
 * 32:20-33:49, straight over the boundary, so it appears in *both* halves
 * here, carrying the same number. That is what lets the navigator show seven
 * entries for the week rather than fourteen.
 */
export function applyCombinedAliyot(
  parts: readonly ParshaText[],
  combined: readonly ComboAliyah[],
): ParshaText[] {
  return parts.map((part) => {
    const aliyot: Aliyah[] = [];

    for (const entry of combined) {
      const start = parseKey(entry.startRef);
      const end = parseKey(entry.endRef);

      let from = -1;
      let to = -1;
      for (const [i, verse] of part.verses.entries()) {
        const addr: VerseAddress = { c: verse.c, v: verse.v };
        if (compareAddress(addr, start) >= 0 && compareAddress(addr, end) <= 0) {
          if (from === -1) from = i;
          to = i;
        }
      }
      // An aliyah that lies wholly in the other half contributes nothing here.
      if (from === -1 || to === -1) continue;

      const first = part.verses[from];
      const last = part.verses[to];
      if (!first || !last) continue;

      aliyot.push({
        n: entry.n,
        from,
        to,
        startRef: verseKey(first.c, first.v),
        endRef: verseKey(last.c, last.v),
      });
    }

    return { ...part, aliyot };
  });
}
