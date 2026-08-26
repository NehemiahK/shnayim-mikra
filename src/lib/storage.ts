/**
 * localStorage can throw (Safari private mode, disabled site data, quota), and
 * a reading app must never white-screen because a preference failed to save.
 * Every access here degrades to an in-memory fallback.
 */
const memory = new Map<string, string>();

function backend(): Storage | undefined {
  try {
    const probe = '__sm_probe__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readRaw(key: string): string | undefined {
  try {
    return backend()?.getItem(key) ?? memory.get(key);
  } catch {
    return memory.get(key);
  }
}

export function writeRaw(key: string, value: string): void {
  memory.set(key, value);
  try {
    backend()?.setItem(key, value);
  } catch {
    /* quota or disabled — the in-memory copy still serves this session */
  }
}

export function removeRaw(key: string): void {
  memory.delete(key);
  try {
    backend()?.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/** Exposed for tests. */
export function clearMemory(): void {
  memory.clear();
}
