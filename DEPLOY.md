# Deploying

The build is fully static, so any static host works. These are the two paths, both free.

Everything below is prepared and verified — the only steps that need you are the
two authentication prompts, because they need your credentials.

## First: use the right Node version

Wrangler needs Node 22+, and your shell may default to an older one. The version
is pinned in `.nvmrc`, so from this directory:

```bash
nvm use
```

`npm run deploy` checks this first and will tell you if it is wrong, so you never
get a confusing error from a tool deeper down.

To switch automatically whenever you `cd` into a project, add to `~/.zshrc`:

```bash
autoload -U add-zsh-hook
load-nvmrc() { [ -f .nvmrc ] && nvm use --silent; }
add-zsh-hook chpwd load-nvmrc
```

## Path A — deploy straight to Cloudflare Pages (fastest, no GitHub needed)

```bash
npx wrangler login
```

That opens a browser once and grants this machine access to your Cloudflare account. Then:

Create the Pages project once (this does not happen automatically in a
non-interactive shell):

```bash
npx wrangler pages project create shnayim-mikra --production-branch=main
```

Then, now and for every future update:

```bash
npm run deploy
```

That builds and uploads `dist/` to the `shnayim-mikra` project, publishing to
`https://shnayim-mikra.pages.dev`.

**Already done** — the project exists and the first deploy is live.

Re-run `npm run deploy` any time to publish an update.

## Path B — connect GitHub (adds CI and the monthly data refresh)

```bash
gh auth login
```

The existing token on this machine has expired, so this re-authenticates. Then:

```bash
gh repo create shnayim-mikra --private --source=. --push
```

Swap `--private` for `--public` if you want it public. Then in the Cloudflare
dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick the repo, and set:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`

Cloudflare then rebuilds on every push, and the two GitHub Actions workflows start
working: CI on each PR, and a monthly job that re-pulls the Sefaria corpus and opens
a PR if the text changed.

**Path A and Path B can both be used** — deploy directly today, connect Git later.

## A custom domain, later

In the Pages project: **Custom domains → Set up a domain**. Cloudflare issues the
certificate automatically. Nothing in the code hardcodes a domain, so no change is
needed on this side.

## Caching

`public/_headers` is already configured: the versioned text data, fonts and hashed
assets are cached immutably for a year, while `index.html` revalidates every time.
A deploy is picked up immediately, but returning readers re-download nothing else.

`public/_redirects` provides the SPA fallback so deep links like `/p/ki-tavo` work.
Both files are read by Cloudflare Pages and Netlify alike.
