/**
 * Cantillation marks (te'amim) U+0591-U+05AF, plus meteg (U+05BD) which is
 * conventionally grouped with them for display purposes.
 */
const TAAMIM = /[\u0591-\u05AF\u05BD]/gu;

/**
 * Vowel points (nikud) U+05B0-U+05BC, rafe (U+05BF), sin/shin dots
 * (U+05C1-U+05C2), and qamats qatan (U+05C7).
 */
const NIKUD = /[\u05B0-\u05BC\u05BF\u05C1\u05C2\u05C7]/gu;

/** How much Hebrew pointing to render. */
export type HebrewStyle = 'taamim' | 'nikud' | 'plain';

/**
 * All three display styles derive from the cantillated text, so we ship one
 * Hebrew field per verse instead of three.
 */
export function renderHebrew(taamimText: string, style: HebrewStyle): string {
  switch (style) {
    case 'taamim':
      return taamimText;
    case 'nikud':
      return taamimText.replace(TAAMIM, '');
    case 'plain':
      return taamimText.replace(TAAMIM, '').replace(NIKUD, '');
  }
}

/** Strip the markup Sefaria embeds, keeping only the plain reading text. */
export function stripMarkup(html: string): string {
  return html
    .replace(/<[^>]*>/gu, '')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim();
}

export interface RichRun {
  t: string;
  b?: true;
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decode(text: string): string {
  return text.replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gu, (m) => ENTITIES[m] ?? m);
}

/**
 * Split Sefaria's commentary markup into styled runs, preserving only the bold
 * spans (the dibur hamatchil) and discarding every other tag. Returning data
 * rather than HTML means the renderer never touches dangerouslySetInnerHTML.
 */
export function parseRuns(html: string): RichRun[] {
  const runs: RichRun[] = [];
  let bold = 0;
  let buffer = '';

  const flush = (): void => {
    // Runs are trimmed because the renderer joins them with a single space;
    // keeping edge whitespace would double it up around every bold span.
    const text = decode(buffer).replace(/\s+/gu, ' ').trim();
    if (text !== '') runs.push(bold > 0 ? { t: text, b: true } : { t: text });
    buffer = '';
  };

  for (const token of html.split(/(<[^>]*>)/gu)) {
    if (!token.startsWith('<')) {
      buffer += token;
      continue;
    }
    const tag = /^<\s*(\/?)\s*(\w+)/u.exec(token);
    if (tag?.[2]?.toLowerCase() === 'b') {
      flush();
      if (tag[1] === '/') bold = Math.max(0, bold - 1);
      else bold++;
    }
    // Every other tag is dropped; its text content still flows into the buffer.
  }
  flush();

  // Merge neighbours that ended up with the same style.
  return runs.reduce<RichRun[]>((acc, run) => {
    const prev = acc[acc.length - 1];
    if (prev && (prev.b === true) === (run.b === true)) {
      prev.t = `${prev.t} ${run.t}`;
      return acc;
    }
    acc.push({ ...run });
    return acc;
  }, []);
}

/** Flatten runs back to plain text — used for search and accessibility labels. */
export function runsToText(runs: readonly RichRun[]): string {
  return runs
    .map((r) => r.t)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
