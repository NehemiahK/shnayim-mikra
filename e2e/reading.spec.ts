import { expect, test, type Page } from '@playwright/test';

/** Ki Tavo is a fixed, known parsha — safe to assert against regardless of date. */
const PARSHA = 'ki-tavo';

async function setSettings(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.addInitScript((p) => {
    const key = 'sm:settings:v1';
    const current = JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
    window.localStorage.setItem(key, JSON.stringify({ ...current, ...p }));
  }, patch);
}

test.describe('home', () => {
  test('shows this week’s parsha and links into it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Shnayim Mikra' })).toBeVisible();
    await expect(page.getByText('This Shabbat', { exact: false })).toBeVisible();

    const cta = page.getByRole('link').filter({ hasText: 'Start reading' }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/p\//u);
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
  });

  test('browses to a parsha by book', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Genesis' }).click();
    await page.getByRole('link', { name: /Bereshit/u }).first().click();
    await expect(page).toHaveURL(/\/p\/bereshit/u);
    await expect(page.locator('article[id="unit-bereshit:1:1"]')).toBeVisible();
  });
});

test.describe('reading a verse', () => {
  test('marks both Mikra readings then the Targum', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    await expect(card).toBeVisible();

    const dots = card.locator('button[aria-pressed]');
    await expect(dots).toHaveCount(3); // mikra x2 + onkelos
    for (const state of await dots.all()) {
      await expect(state).toHaveAttribute('aria-pressed', 'false');
    }

    const mikra = card.getByRole('button', { name: 'Mikra 26:1', exact: true });
    await mikra.click();
    await expect(dots.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(dots.nth(1)).toHaveAttribute('aria-pressed', 'false');

    await mikra.click();
    await expect(dots.nth(1)).toHaveAttribute('aria-pressed', 'true');

    // A third tap must not wrap around and clear the verse.
    await mikra.click();
    await expect(dots.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(dots.nth(1)).toHaveAttribute('aria-pressed', 'true');

    await card.getByRole('button', { name: 'Onkelos 26:1', exact: true }).click();
    await expect(dots.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('3/366')).toBeVisible();
  });

  test('rapid taps register every reading', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    const mikra = card.getByRole('button', { name: 'Mikra 26:1', exact: true });

    // No awaits between clicks: this is the stale-closure regression.
    await mikra.click({ delay: 0 });
    await mikra.click({ delay: 0 });

    const dots = card.locator('button[aria-pressed]');
    await expect(dots.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(dots.nth(1)).toHaveAttribute('aria-pressed', 'true');
  });

  test('a single dot can be un-marked without clearing the verse', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    const dots = card.locator('button[aria-pressed]');

    await card.getByRole('button', { name: 'Mikra 26:1', exact: true }).click();
    await card.getByRole('button', { name: 'Mikra 26:1', exact: true }).click();
    await dots.nth(0).click();

    await expect(dots.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(dots.nth(1)).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Rashi and translation', () => {
  test('expanding a verse loads Rashi and the translation', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    // Scoped by aria-controls: the card expander and Rashi's English disclosure
    // are both aria-expanded buttons.
    const expand = card.locator('button[aria-controls^="detail-"]');

    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expand.click();
    await expect(expand).toHaveAttribute('aria-expanded', 'true');

    const detail = card.locator('[id^="detail-"]');
    await expect(detail.getByRole('heading', { name: 'Translation' })).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Rashi' })).toBeVisible();
    await expect(detail).toContainText('When it happens that you come to the land');

    // The dibur hamatchil is what makes Rashi navigable — it must survive.
    await expect(detail.locator('strong').first()).toBeVisible();
    await expect(detail.locator('strong').first()).toContainText('והיה כי תבוא');

    // Rashi's own English stays behind its disclosure here too.
    await expect(detail).not.toContainText('This teaches that');
    await detail.getByRole('button', { name: 'English' }).first().click();
    await expect(detail).toContainText('This teaches that');
  });

  test('translation can be shown inline under every verse', async ({ page }) => {
    await setSettings(page, { showTranslation: true });
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    await expect(card).toContainText('When it happens that you come to the land');
  });
});

test.describe('settings', () => {
  test('Rashi can replace Onkelos as the third reading', async ({ page }) => {
    await setSettings(page, { targum: 'rashi' });
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    await expect(card.getByRole('button', { name: 'Rashi 1 26:1', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Onkelos 26:1', exact: true })).toHaveCount(0);
  });

  test('reading both Onkelos and Rashi adds a fourth step', async ({ page }) => {
    await setSettings(page, { targum: 'both' });
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    await expect(card.locator('button[aria-pressed]')).toHaveCount(4);
  });

  test('Rashi keeps its English behind a disclosure', async ({ page }) => {
    await setSettings(page, { targum: 'rashi' });
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();

    const english = card.getByRole('button', { name: 'English' }).first();
    await expect(english).toHaveAttribute('aria-expanded', 'false');
    await expect(card).not.toContainText('This teaches that');

    await english.click();
    await expect(english).toHaveAttribute('aria-expanded', 'true');
    await expect(card).toContainText('This teaches that');

    await english.click();
    await expect(card).not.toContainText('This teaches that');
  });

  test('Rashi English can start open', async ({ page }) => {
    await setSettings(page, { targum: 'rashi', rashiEnglish: true });
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    await expect(card.getByRole('button', { name: 'English' }).first()).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(card).toContainText('This teaches that');
  });

  test('aliyah mode reads in blocks instead of verse by verse', async ({ page }) => {
    await setSettings(page, { structure: 'aliyah' });
    await page.goto(`/p/${PARSHA}`);
    await expect(page.locator('#unit-ki-tavo\\:a1\\:mikra1')).toBeVisible();
    // 7 aliyot x (2 mikra + 1 targum)
    await expect(page.locator('article[id^="unit-"]')).toHaveCount(21);
    await expect(page.getByText('Aliyah 1 · 11 verses').first()).toBeVisible();
  });

  test('cantillation can be stripped down to vowels or bare letters', async ({ page }) => {
    const taamim = /[֑-֯]/u;
    const nikud = /[ְ-ּ]/u;

    await page.goto(`/p/${PARSHA}`);
    const withTaamim = await page.locator('.hebrew').first().innerText();
    expect(withTaamim).toMatch(taamim);

    await setSettings(page, { hebrewStyle: 'nikud' });
    await page.reload();
    const vowelsOnly = await page.locator('.hebrew').first().innerText();
    expect(vowelsOnly).not.toMatch(taamim);
    expect(vowelsOnly).toMatch(nikud);

    await setSettings(page, { hebrewStyle: 'plain' });
    await page.reload();
    const bare = await page.locator('.hebrew').first().innerText();
    expect(bare).not.toMatch(nikud);
    expect(bare).toContain('והיה');
  });

  test('the Hebrew interface flips the layout to RTL', async ({ page }) => {
    await setSettings(page, { uiLang: 'he' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.getByRole('heading', { name: 'שנים מקרא' })).toBeVisible();
  });

  test('dark theme is applied to the document', async ({ page }) => {
    await setSettings(page, { theme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('changing a setting from the settings page persists it', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('radio', { name: 'Vowels only' }).click();
    await page.goto(`/p/${PARSHA}`);
    const text = await page.locator('.hebrew').first().innerText();
    expect(text).not.toMatch(/[֑-֯]/u);
  });
});

test.describe('progress', () => {
  test('survives a reload and is scoped to one parsha', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    await card.getByRole('button', { name: 'Mikra 26:1', exact: true }).click();
    await expect(card.locator('button[aria-pressed]').nth(0)).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(
      page.locator('article[id^="unit-"]').first().locator('button[aria-pressed]').nth(0),
    ).toHaveAttribute('aria-pressed', 'true');

    // A different parsha must start clean.
    await page.goto('/p/bereshit');
    await expect(
      page.locator('article[id^="unit-"]').first().locator('button[aria-pressed]').nth(0),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('shows up on the home screen after reading', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    await card.getByRole('button', { name: 'Mikra 26:1', exact: true }).click();
    await page.goto('/');
    await expect(page.getByText('Continue reading').first()).toBeVisible();
  });
});

test.describe('combined parshiyot', () => {
  test('reads both halves in one session', async ({ page }) => {
    await page.goto('/p/matot-masei');
    await expect(page.locator('article[id^="unit-matot:"]').first()).toBeVisible();
    // Both halves contribute aliyot to the navigator.
    await expect(page.locator('nav button')).toHaveCount(14);
    await expect(page.locator('article[id^="unit-masei:"]').first()).toBeVisible();
  });
});

test.describe('robustness', () => {
  test('an unknown parsha shows a recovery link, not a crash', async ({ page }) => {
    await page.goto('/p/not-a-real-parsha');
    await expect(page.getByText('That parsha does not exist.')).toBeVisible();
    await page.getByRole('link', { name: 'Go to the start' }).click();
    await expect(page).toHaveURL(/\/$/u);
  });

  test('V’Zot HaBerachah is readable even though it is never scheduled', async ({ page }) => {
    await page.goto('/p/vzot-haberachah');
    await expect(page.locator('article[id^="unit-vzot-haberachah"]').first()).toBeVisible();
  });
});
