import { describe, expect, it } from 'vitest';
import { parseRuns, renderHebrew, runsToText, stripMarkup } from './hebrew.js';

// Genesis 1:1 as shipped: consonants + nikud + te'amim.
const CANTILLATED = 'בְּרֵאשִׁית֖ בָּרָ֣א';

describe('renderHebrew', () => {
  it('keeps everything in taamim mode', () => {
    expect(renderHebrew(CANTILLATED, 'taamim')).toBe(CANTILLATED);
  });

  it('drops cantillation but keeps vowels in nikud mode', () => {
    const out = renderHebrew(CANTILLATED, 'nikud');
    expect(out).not.toMatch(/[\u0591-\u05AF]/u);
    expect(out).toMatch(/[\u05B0-\u05BC]/u); // vowels survive
  });

  it('drops all pointing in plain mode', () => {
    const out = renderHebrew(CANTILLATED, 'plain');
    expect(out).not.toMatch(/[\u0591-\u05BC\u05BF\u05C1\u05C2\u05C7]/u);
    expect(out).toBe('בראשית ברא');
  });

  it('never changes the consonantal skeleton', () => {
    const consonants = (s: string): string => s.replace(/[^\u05D0-\u05EA ]/gu, '');
    for (const style of ['taamim', 'nikud', 'plain'] as const) {
      expect(consonants(renderHebrew(CANTILLATED, style))).toBe(consonants(CANTILLATED));
    }
  });
});

describe('stripMarkup', () => {
  it('removes tags and collapses whitespace', () => {
    expect(stripMarkup('<b>בראשית.</b>  said   Rabbi')).toBe(
      'בראשית. said Rabbi',
    );
  });

  it('decodes the entities Sefaria emits', () => {
    expect(stripMarkup('a &amp; b &nbsp;&quot;c&quot;')).toBe('a & b "c"');
  });

  it('is a no-op on already-plain text', () => {
    expect(stripMarkup('In the beginning God created')).toBe('In the beginning God created');
  });
});

describe('parseRuns', () => {
  it('marks the bolded dibur hamatchil', () => {
    expect(parseRuns('<b>בראשית.</b> אָמַר רַבִּי')).toEqual([
      { t: 'בראשית.', b: true },
      { t: 'אָמַר רַבִּי' },
    ]);
  });

  it('drops every tag except bold, keeping the text inside', () => {
    expect(parseRuns('<i>an</i> <small>aside</small>')).toEqual([{ t: 'an aside' }]);
  });

  it('merges adjacent runs of the same style', () => {
    expect(parseRuns('<i>one</i> <i>two</i>')).toEqual([{ t: 'one two' }]);
  });

  it('handles bold in the middle of a comment', () => {
    expect(parseRuns('before <b>middle</b> after')).toEqual([
      { t: 'before' },
      { t: 'middle', b: true },
      { t: 'after' },
    ]);
  });

  it('decodes entities and collapses whitespace', () => {
    expect(parseRuns('a &amp;  b\n\nc')).toEqual([{ t: 'a & b c' }]);
  });

  it('survives unbalanced and stray tags', () => {
    expect(parseRuns('<b>open only')).toEqual([{ t: 'open only', b: true }]);
    expect(parseRuns('</b>close only')).toEqual([{ t: 'close only' }]);
    expect(parseRuns('')).toEqual([]);
    expect(parseRuns('   ')).toEqual([]);
  });

  it('never emits empty runs', () => {
    for (const run of parseRuns('<b></b>text<b>  </b>more')) {
      expect(run.t.trim().length).toBeGreaterThan(0);
    }
  });

  it('round-trips to plain text', () => {
    expect(runsToText(parseRuns('<b>בראשית.</b> אָמַר'))).toBe('בראשית. אָמַר');
  });
});
