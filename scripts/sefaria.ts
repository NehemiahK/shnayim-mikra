/**
 * Thin, typed client for the parts of the Sefaria API this project uses.
 * Only ever runs at build time — nothing here ships to the browser.
 */
import type { Book } from '../src/lib/schema.js';

const API = 'https://www.sefaria.org/api';

export interface SefariaVersion {
  versionTitle: string;
  actualLanguage: string;
  license?: string;
  text: unknown;
}

interface AvailableVersion {
  versionTitle: string;
  actualLanguage: string;
  license?: string;
}

interface V3Response {
  versions?: SefariaVersion[];
  available_versions?: AvailableVersion[];
  warnings?: unknown[];
}

interface ParashaNode {
  wholeRef?: string;
  refs?: string[];
  sharedTitle?: string;
  titles?: { primary?: boolean; text: string; lang: string }[];
}

interface IndexResponse {
  alts?: { Parasha?: { nodes?: ParashaNode[] } };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string, attempt = 1): Promise<T> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'shnayim-mikra-build/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${String(res.status)} for ${url}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt >= 4) throw err;
    const backoff = 500 * 2 ** attempt;
    console.warn(`  retry ${String(attempt)} in ${String(backoff)}ms — ${String(err)}`);
    await sleep(backoff);
    return getJson<T>(url, attempt + 1);
  }
}

/**
 * Sefaria's version titles drift between books (the Rosenbaum Rashi is titled
 * slightly differently for Numbers than for Genesis), so we never hardcode a
 * title. Instead we list what's actually available for a ref and pick the first
 * edition matching an ordered preference list.
 */
export interface EditionPreference {
  language: 'he' | 'en';
  /** Tried in order; first match wins. */
  match: ((title: string) => boolean)[];
  label: string;
}

export interface ResolvedEdition {
  versionTitle: string;
  language: string;
  license: string;
}

export async function listVersions(ref: string): Promise<AvailableVersion[]> {
  const data = await getJson<V3Response>(`${API}/v3/texts/${encodeURIComponent(ref)}`);
  await sleep(200);
  return data.available_versions ?? [];
}

export function resolveEdition(
  available: AvailableVersion[],
  pref: EditionPreference,
  context: string,
): ResolvedEdition {
  const candidates = available.filter((v) => v.actualLanguage === pref.language);
  for (const matcher of pref.match) {
    const hit = candidates.find((v) => matcher(v.versionTitle));
    if (hit) {
      return {
        versionTitle: hit.versionTitle,
        language: pref.language,
        license: hit.license ?? 'unknown',
      };
    }
  }
  throw new Error(
    `No ${pref.label} (${pref.language}) edition for ${context}. Available: ${candidates
      .map((v) => v.versionTitle)
      .join(' | ')}`,
  );
}

/** Fetch one resolved edition of a whole book. */
export async function fetchText(ref: string, edition: ResolvedEdition): Promise<unknown> {
  const spec = `${edition.language === 'he' ? 'hebrew' : 'english'}|${edition.versionTitle}`;
  const url = `${API}/v3/texts/${encodeURIComponent(ref)}?version=${encodeURIComponent(spec)}`;
  const data = await getJson<V3Response>(url);
  const version = data.versions?.[0];
  if (!version) {
    throw new Error(`No text for "${ref}" version "${spec}". Warnings: ${JSON.stringify(data.warnings)}`);
  }
  await sleep(250); // be a good citizen
  return version.text;
}

export interface ParashaEntry {
  nameEn: string;
  nameHe: string;
  wholeRef: string;
  aliyotRefs: string[];
}

/** Read the parsha/aliyah map out of a book's index. */
export async function fetchParshiyot(book: Book): Promise<ParashaEntry[]> {
  const data = await getJson<IndexResponse>(`${API}/v2/index/${encodeURIComponent(book)}`);
  const nodes = data.alts?.Parasha?.nodes;
  if (!nodes?.length) throw new Error(`No Parasha nodes in index for ${book}`);

  return nodes.map((node, i) => {
    const wholeRef = node.wholeRef;
    const aliyotRefs = node.refs;
    if (!wholeRef || !aliyotRefs?.length) {
      throw new Error(`Parasha node ${String(i)} of ${book} is missing wholeRef/refs`);
    }
    const nameEn = node.sharedTitle ?? node.titles?.find((t) => t.primary && t.lang === 'en')?.text;
    const nameHe = node.titles?.find((t) => t.primary && t.lang === 'he')?.text;
    if (!nameEn || !nameHe) throw new Error(`Parasha node ${String(i)} of ${book} is missing titles`);
    return { nameEn, nameHe, wholeRef, aliyotRefs };
  });
}
