# Reminders / push notifications — research, parked

Status: **not built.** Researched September 2026, deferred. This exists so the
dead ends below don't get re-researched.

## The finding that decides everything

**A web app cannot schedule a notification without a server.** There is no
local-only path:

- **Notification Triggers API** (`showTrigger` / `TimestampTrigger`) was exactly
  the API for this — schedule a notification locally, no backend. Google
  [ended development](https://developer.chrome.com/docs/web-platform/notification-triggers):
  *"It wasn't clear that we could provide consistent and reliable experiences
  across platforms."* It is listed under "No longer pursuing". Dead.
- **Periodic Background Sync** is Chromium-only, and even there it is gated on
  site-engagement heuristics — no guarantee it fires at a chosen time. Useless
  for an iOS-first audience.

So reminders mean **Web Push**, and Web Push means a backend. That is the whole
cost of this feature; everything else is small.

## The trade this represents

The About page currently says:

> "Your progress is saved on this device only. Nothing is sent anywhere."

That becomes false the moment anyone enables reminders — a push subscription,
their chosen time, and their timezone would live on a server. This would also be
the app's first backend, first stored user data, and first secret to manage,
against an app whose defining property is being a static site with none of those.

Decided anyway: **go with full Web Push**, with a **user-selectable day and
time** (default Thursday evening). Recorded here so the reasoning isn't relitigated.

## Constraints found (each would otherwise cause a wrong turn)

- **iOS only supports web push for PWAs installed via Share → Add to Home
  Screen**, and there is no way to prompt for that. Most iOS visitors won't have
  installed it, so for them the UI must show "Add to Home Screen to enable
  reminders" — never a toggle that silently does nothing. This is the biggest
  limitation of the feature.
- **The widely-repeated claim that iOS web push is blocked in the EU is stale.**
  Apple [reversed it](https://techcrunch.com/2024/03/01/apple-reverses-decision-about-blocking-web-apps-on-iphones-in-the-eu/)
  before iOS 17.4 shipped. Home Screen web apps, and push, work in the EU.
- **Cloudflare Pages Functions cannot run cron.** The send loop has to be a
  standalone Worker. (Cron triggers are on the free plan; 1-minute minimum.)
- **The `web-push` npm package does not run on Workers** — it needs Node crypto.
  Use a Web Crypto build such as
  [`@block65/webcrypto-web-push`](https://github.com/block65/webcrypto-web-push).
- **`generateSW` cannot host a push handler.** Workbox's own docs name Web Push
  as the reason to switch to `injectManifest`. That means hand-owning the
  service worker, which today is generated. `e2e/offline.spec.ts` is the safety
  net for that migration — it must pass unchanged.

## Shape it would take

One standalone Worker (HTTP + cron in one place; splitting HTTP into Pages
Functions would mean two deployables and two D1 bindings to keep in step, to
save only a few CORS headers):

- `POST /subscribe` / `POST /unsubscribe`
- `scheduled()` on an **hourly** cron → find subscriptions whose *local* time is
  now → send → record

D1 table keyed on `endpoint`, storing `p256dh`, `auth`, **IANA timezone**,
`weekday`, `hour`, `lang`, `region`, `last_sent_at`.

Two details worth not getting wrong:

- Store the **IANA timezone**, never a fixed UTC offset — an offset drifts an
  hour at every DST change and delivers reminders at the wrong time for half the
  year. Resolve local time per row with `Intl.DateTimeFormat(..., { timeZone })`.
- **Delete subscriptions on `404`/`410`** from the push service; that's the
  standard "endpoint is permanently gone" signal, and without it dead rows
  accumulate forever.

Keep the due-now decision as a **pure function** (`dueSubscriptions(rows, now)`)
so DST boundaries, hour/weekday edges, and the `last_sent_at` guard are unit
testable without a Worker.

### Reuse, don't reinvent

The Worker can name the parsha with the app's existing `readingForDate()` /
`resolveParsha()` from `src/lib/calendar.ts`, backed by the committed
`src/data/calendar.json` and `src/data/parshiyot.json` — wrangler bundles JSON
imports. One source of truth for what this week's reading is; no schedule logic
duplicated server-side.

### Setup that needs account access

Generate a VAPID keypair; `wrangler d1 create`; `wrangler secret put
VAPID_PRIVATE_KEY`; public key into the client as `VITE_VAPID_PUBLIC_KEY` and
the Worker URL as `VITE_PUSH_API`.

## Lower-cost alternative, if this ever looks too heavy

A **"remind me weekly" `.ics` download** — a recurring calendar event with an
alarm, added to the user's own calendar. No backend, no stored data, no install
requirement, works on every platform, keeps the privacy promise intact, and uses
OS-native alarms which are more reliable than web push. Less integrated, and the
reminder lives in their calendar rather than the app.
