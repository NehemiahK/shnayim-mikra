# Shnayim Mikra

A fast, mobile-first web app for reading the weekly parsha **shnayim mikra v'echad targum** — each verse twice in Hebrew, once in Targum — with Rashi and an English translation a tap away.

Works offline, installs to a phone's home screen, keeps your progress on your device, and costs nothing to host.

## What makes it fast

**There is no backend, and no API calls at runtime.** The Torah does not change, so the entire corpus — Hebrew, Targum Onkelos, Rashi, and an English translation — is fetched from [Sefaria](https://www.sefaria.org) at build time, sliced by parsha and aliyah, and committed as static JSON.

That decision buys a lot:

- Opening a parsha is a single static file fetch (~26 KB gzipped), served from a CDN edge.
- Rashi is a separate chunk, downloaded only when a reader actually expands it.
- No rate limits, no CORS, no outage to inherit, no server to pay for.
- Offline works by default — there is nothing dynamic to be offline *from*.
- Which parsha falls on which Shabbat is precomputed for 25 years into a lookup table, so no calendar library ships to the browser either.

The whole app is 78 KB of JavaScript, gzipped.

## Texts

Every default edition is **public domain**:

| Role | Edition |
| --- | --- |
| Torah (Hebrew) | Tanach with Ta'amei Hamikra |
| Torah (English) | The Holy Scriptures: A New Translation (JPS 1917) |
| Targum Onkelos | Onkelos, vocalized |
| Rashi | Pentateuch with Rashi's commentary, Rosenbaum & Silbermann, 1929–1934 |

The pipeline **discovers** editions by preference rather than hardcoding titles — Sefaria titles the same edition differently between books — and records what it actually used in `src/data/attribution.json`, which the About page renders. Attribution can't drift from reality.

Only one Hebrew field is stored per verse. Vowels-only and letters-only display are derived at render time by stripping Unicode ranges, which is exactly what those marks are.

## Customization

Everything below is a setting, persisted locally:

- **Third reading** — Onkelos (standard), Rashi in its place (per the Rema), or both.
- **Reading structure** — verse by verse, or whole-aliyah blocks.
- **Hebrew readings** — two by custom, adjustable.
- **Hebrew text** — with cantillation, vowels only, or letters only.
- **Translation** — off, inline under every verse, or expand-only.
- **Text size**, **side-by-side Targum**, **light/dark/system**, **auto-scroll**.
- **Schedule** — Diaspora or Israel (they diverge for part of the year after Pesach).
- **Interface language** — English or Hebrew, with a fully mirrored RTL layout.

Rashi is always available on expand regardless of which text counts as the third reading.

## Development

```bash
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck and build to `dist/` |
| `npm test` | Unit, component and corpus tests |
| `npm run test:e2e` | Playwright, on mobile and desktop viewports |
| `npm run lint` | ESLint |
| `npm run size` | Enforce the performance budget |
| `npm run data:build` | Re-fetch the corpus from Sefaria |
| `npm run fonts:build` | Re-fetch the self-hosted Hebrew font |

Node 22 (see `.nvmrc`) — run `nvm use` if your shell defaults to an older version. TypeScript runs with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`.

### Testing

Roughly 270 unit and component tests plus 44 end-to-end tests.

The corpus tests are the important ones. They re-validate every committed file against its Zod schema and assert the things that would actually harm a reader: that Hebrew and Onkelos verse counts match, that aliyot tile each parsha with no gaps or overlaps, that no verse is missing any of its three texts, that the books are contiguous end to end, and that every Rashi comment lands on a real verse. `npm run data:build` fails loudly rather than shipping a corpus that violates any of them.

Zod is a dev dependency only. `src/lib/types.ts` holds runtime-free types for the app; `src/lib/schema.ts` holds the matching schemas for the pipeline and tests, with compile-time checks that the two cannot drift.

WebKit is opt-in locally (`PW_WEBKIT=1`) because its prebuilt binary segfaults on some macOS/arm64 hosts; CI runs it on Linux, so iOS Safari is covered there.

## Deploying

The build is fully static — any static host works, free. See **[DEPLOY.md](DEPLOY.md)**
for the exact steps.

The short version, from this directory:

```bash
nvm use && npx wrangler login && npm run deploy
```

That builds and publishes to Cloudflare Pages. `public/_headers` and
`public/_redirects` handle caching and the SPA fallback, and nothing hardcodes a
domain, so attaching a custom one later needs no code change.

## A note on V'Zot HaBerachah

It is read on Simchat Torah, a festival, so it never falls on a regular Shabbat and never appears in the weekly schedule. It is still browsable and readable from the parsha list, since people do read it beforehand. The calendar tests assert both halves of this.

## License

The application code is MIT licensed — see [LICENSE](LICENSE).

The Torah, Targum Onkelos, Rashi and English translation are not covered by
that license and are not owned by this project. Every edition used is in the
public domain, sourced from [Sefaria](https://www.sefaria.org); the exact
editions and their licenses are listed in `src/data/attribution.json` and shown
on the app's About page.
