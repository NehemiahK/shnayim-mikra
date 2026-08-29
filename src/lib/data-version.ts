/**
 * Version suffixes for the committed text payloads.
 *
 * `/data/**` is served `immutable` for a year and cached CacheFirst by the
 * service worker, so a file's *name* is the only thing that can invalidate it.
 * Any change to the shape of a payload must bump its version here, or existing
 * installs keep their old file and hand differently-shaped JSON to new code.
 *
 * Kept in its own dependency-free module so the build pipeline, the runtime
 * loader, and the corpus tests all read the same constant — the writer and the
 * reader drifting apart is precisely the failure this guards against.
 *
 * History:
 *   parsha v1 -> v2  added `oe`, the Targum in English
 */
export const PARSHA_DATA_VERSION = 'v2';

/** Rashi payloads are unchanged since v1; bumping needlessly would force
 *  offline readers to re-download several megabytes for nothing. */
export const RASHI_DATA_VERSION = 'v1';
