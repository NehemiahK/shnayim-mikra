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

test.describe('scrolling', () => {
  // Tapping must never move the page — that was the intrusive behaviour.
  // Keyboard use is the exception: pressing Space with nothing focused gives
  // no other signal about where you now are, and even then it only scrolls
  // when the target is genuinely not visible.
  test('the whole-verse checkbox does not scroll', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const before = await page.evaluate(() => window.scrollY);
    await page.getByRole('checkbox', { name: /Mark verse read/u }).first().click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('a single dot does not scroll', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const before = await page.evaluate(() => window.scrollY);
    await page.getByRole('button', { name: 'Mikra 26:1', exact: true }).click();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('Space does not scroll while the current verse is still on screen', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
    await page.evaluate(() => { document.body.focus(); });

    const before = await page.evaluate(() => window.scrollY);
    // First verse is at the top of the page; working through its readings
    // should leave the viewport completely still.
    await page.keyboard.press(' ');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await page.keyboard.press(' ');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('Space scrolls once the next reading would be off screen', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
    await page.evaluate(() => { document.body.focus(); });

    // Work far enough down that the next verse cannot still be in view.
    for (let i = 0; i < 24; i++) await page.keyboard.press(' ');

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test('never leaves the next reading hidden under the sticky header', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
    await page.evaluate(() => { document.body.focus(); });

    for (let i = 0; i < 30; i++) await page.keyboard.press(' ');
    await page.waitForTimeout(600); // let any smooth scroll settle

    const clear = await page.evaluate(() => {
      const header = document.querySelector('.sticky');
      const card = [...document.querySelectorAll('article[id^="unit-"]')].find((c) =>
        c.querySelector('[role="checkbox"][aria-checked="false"], [role="checkbox"][aria-checked="mixed"]'),
      );
      if (!header || !card) return null;
      const h = header.getBoundingClientRect().bottom;
      const r = card.getBoundingClientRect();
      return { cardTop: r.top, headerBottom: h, withinViewport: r.top < window.innerHeight };
    });

    expect(clear).not.toBeNull();
    // The next thing to read must start below the header, not behind it.
    expect(clear!.cardTop).toBeGreaterThanOrEqual(clear!.headerBottom);
    expect(clear!.withinViewport).toBe(true);
  });

  test('scrolls about once per verse, not on every press', async ({ page }) => {
    // Regression guard. With a smooth scroll this compounded badly: a press
    // arriving mid-animation measured a still-moving page and stacked another
    // scroll on top, turning once-per-verse into scrolling on 38 of 40
    // presses.
    await page.goto(`/p/${PARSHA}`);
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
    await page.evaluate(() => { document.body.focus(); });

    const positions: number[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press(' ');
      await page.waitForTimeout(250);
      positions.push(Math.round(await page.evaluate(() => window.scrollY)));
    }

    const moves = positions.filter((y, i) => i > 0 && y !== positions[i - 1]).length;
    // Three readings per verse, so roughly a third of presses should move.
    expect(moves).toBeGreaterThan(0);
    expect(moves).toBeLessThanOrEqual(5);
  });

  test('every press advances exactly one reading, however fast they arrive', async ({ page }) => {
    // The keyboard handler reads progress from the store rather than its
    // render closure. Reading the closure meant presses landing before React
    // re-rendered all saw the same "next" step, so holding the key marked one
    // reading repeatedly instead of moving through them.
    const runAt = async (gap: number): Promise<string[]> => {
      await page.goto(`/p/${PARSHA}`);
      // Progress persists in localStorage, so the second run would otherwise
      // continue from where the first stopped.
      await page.evaluate(() => { localStorage.clear(); });
      await page.reload();
      await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
      await page.evaluate(() => { document.body.focus(); });
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press(' ');
        if (gap > 0) await page.waitForTimeout(gap);
      }
      await page.waitForTimeout(400);
      return page.evaluate(
        () => JSON.parse(localStorage.getItem('sm:progress:v1:ki-tavo') ?? '[]') as string[],
      );
    };

    const fast = await runAt(0);
    const slow = await runAt(300);

    expect(fast).toHaveLength(12);
    expect([...fast].sort()).toEqual([...slow].sort());
  });

  test('the aliyah-nav jump-to button scrolls — that is direct navigation', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    await page.evaluate(() => window.scrollTo(0, 0));
    const before = await page.evaluate(() => window.scrollY);

    const nav = page.locator('nav').first();
    await nav.getByRole('button').nth(3).click();

    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });
});

test.describe('whole-verse checkbox', () => {
  test('marks every step of a verse done in one tap', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    const checkbox = card.getByRole('checkbox', { name: /Mark verse read/u });
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await checkbox.click();

    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
    for (const dot of await card.locator('button[aria-pressed]').all()) {
      await expect(dot).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('undoes the whole verse on a second tap', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    const checkbox = card.getByRole('checkbox', { name: /Mark verse read/u });

    await checkbox.click();
    await checkbox.click();

    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
    for (const dot of await card.locator('button[aria-pressed]').all()) {
      await expect(dot).toHaveAttribute('aria-pressed', 'false');
    }
  });

  test('shows mixed state after only a partial reading, and completes from there', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    const checkbox = card.getByRole('checkbox', { name: /Mark verse read/u });

    await card.getByRole('button', { name: 'Mikra 26:1', exact: true }).click();
    await expect(checkbox).toHaveAttribute('aria-checked', 'mixed');

    await checkbox.click();
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  test('persists across a reload like any other completion', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    await card.getByRole('checkbox', { name: /Mark verse read/u }).click();

    await page.reload();
    await expect(
      page.locator('article[id^="unit-"]').first().getByRole('checkbox', { name: /Mark verse read/u }),
    ).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('keyboard shortcut', () => {
  test('each press checks off one reading, not the whole verse', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
    // A keyboard-only user who has not yet tabbed to anything specific has
    // focus resting on the document body — set that explicitly rather than
    // trusting a click not to land on the back link in the corner.
    await page.evaluate(() => { document.body.focus(); });

    const first = page.locator('#unit-ki-tavo\\:26\\:1');
    const dots = first.locator('button[aria-pressed]');

    await page.keyboard.press(' ');
    await expect(dots.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(dots.nth(1)).toHaveAttribute('aria-pressed', 'false');
    await expect(dots.nth(2)).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press(' ');
    await expect(dots.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(dots.nth(2)).toHaveAttribute('aria-pressed', 'false');

    await page.keyboard.press(' ');
    await expect(dots.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await expect(first.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  test('carries on into the next verse once one is finished', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
    await page.evaluate(() => { document.body.focus(); });

    // Three readings finishes verse 1; the fourth starts verse 2.
    for (let i = 0; i < 4; i++) await page.keyboard.press(' ');

    await expect(
      page.locator('#unit-ki-tavo\\:26\\:1').getByRole('checkbox'),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      page.locator('#unit-ki-tavo\\:26\\:2').getByRole('checkbox'),
    ).toHaveAttribute('aria-checked', 'mixed');
  });

  test('Enter works the same way as Space', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
    await page.evaluate(() => { document.body.focus(); });
    await page.keyboard.press('Enter');

    const first = page.locator('#unit-ki-tavo\\:26\\:1');
    await expect(first.locator('button[aria-pressed]').nth(0)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('does not fire while a specific control has keyboard focus', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    // Tab to a specific dot on purpose, then press Space — this must toggle
    // only that one dot, exactly as clicking it would, not the whole verse.
    await card.getByRole('button', { name: 'Mikra first reading 26:1' }).focus();
    await page.keyboard.press(' ');

    await expect(card.getByRole('button', { name: 'Mikra first reading 26:1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(card.getByRole('button', { name: 'Mikra second reading 26:1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('shows a hint on desktop but not on a touch device', async ({ page, isMobile }) => {
    await page.goto(`/p/${PARSHA}`);
    const hint = page.getByText('Press Space to check off each reading as you go');
    if (isMobile) {
      await expect(hint).toBeHidden();
    } else {
      await expect(hint).toBeVisible();
    }
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

test.describe('Targum in English', () => {
  test('sits behind a disclosure under the Aramaic, closed by default', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('#unit-ki-tavo\\:26\\:1');
    const toggle = card.getByRole('button', { name: 'English' });

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(card).not.toContainText('When it happens that you come to the land');

    await toggle.click();
    await expect(card).toContainText('When it happens that you come to the land');
  });

  test('marks where Onkelos departs from the literal Hebrew', async ({ page }) => {
    await setSettings(page, { onkelosEnglish: true });
    await page.goto(`/p/${PARSHA}`);

    // 26:3 renders "to [before] Adonoy" — Onkelos avoiding the direct phrasing.
    const card = page.locator('#unit-ki-tavo\\:26\\:3');
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('strong').first()).toHaveText(/before/u);
  });

  test('can start open from Settings', async ({ page }) => {
    await setSettings(page, { onkelosEnglish: true });
    await page.goto(`/p/${PARSHA}`);
    await expect(
      page.locator('#unit-ki-tavo\\:26\\:1').getByRole('button', { name: 'English' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  test('does not nest its control inside the tap-to-mark target', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const nested = await page
      .locator('#unit-ki-tavo\\:26\\:1 button button')
      .count();
    expect(nested).toBe(0);
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

test.describe('quick targum switch on the reading page', () => {
  // github.com/NehemiahK/shnayim-mikra/issues/3 — reachable without a trip to
  // Settings, since a reader may want to change it mid-parsha.
  test('is visible immediately, with no navigation to Settings', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const switcher = page.getByRole('radiogroup', { name: 'Third reading' });
    await expect(switcher).toBeVisible();
    await expect(switcher.getByRole('radio', { name: 'Onkelos' })).toHaveAttribute('aria-checked', 'true');
  });

  test('switching it changes the reading immediately, without a reload', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator('article[id^="unit-"]').first();
    await expect(card.getByRole('button', { name: 'Onkelos 26:1', exact: true })).toBeVisible();

    await page.getByRole('radiogroup', { name: 'Third reading' }).getByRole('radio', { name: 'Rashi' }).click();

    await expect(card.getByRole('button', { name: 'Rashi 1 26:1', exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Onkelos 26:1', exact: true })).toHaveCount(0);
  });

  test('agrees with the Settings page — the same underlying setting, not a separate copy', async ({ page }) => {
    await page.goto(`/p/${PARSHA}`);
    await page.getByRole('radiogroup', { name: 'Third reading' }).getByRole('radio', { name: 'Both' }).click();

    await page.goto('/settings');
    await expect(page.getByRole('radio', { name: 'Onkelos and Rashi' })).toHaveAttribute('aria-checked', 'true');

    // And the reverse direction: a change made in Settings shows up here too.
    await page.getByRole('radio', { name: 'Onkelos', exact: true }).click();
    await page.goto(`/p/${PARSHA}`);
    await expect(
      page.getByRole('radiogroup', { name: 'Third reading' }).getByRole('radio', { name: 'Onkelos' }),
    ).toHaveAttribute('aria-checked', 'true');
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
    await expect(page.locator('article[id^="unit-masei:"]').first()).toBeVisible();
  });

  test('is read as seven aliyot, the way the week is actually leined', async ({ page }) => {
    await page.goto('/p/matot-masei');
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
    // Seven, not fourteen — a combined week has its own divisions spanning
    // both halves rather than each parsha's own seven back to back.
    await expect(page.locator('nav').first().getByRole('button')).toHaveCount(7);
  });

  test('has an aliyah spanning the seam between the two parshiyot', async ({ page }) => {
    await page.goto('/p/matot-masei');
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();

    // Matot-Masei's fourth aliyah runs 32:20-33:49, crossing out of Matot and
    // into Masei — the property that makes combined divisions irreducible to a
    // concatenation of the two.
    await page.locator('nav').first().getByRole('button').nth(3).click();
    await expect(page.locator('#unit-matot\\:32\\:20')).toHaveCount(1);
    await expect(page.locator('#unit-masei\\:33\\:49')).toHaveCount(1);
  });

  test('falls back to each half having its own seven when set to separate', async ({ page }) => {
    await setSettings(page, { doubleParsha: 'separate' });
    await page.goto('/p/matot-masei');
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();

    const nav = page.locator('nav').first();
    await expect(nav.getByRole('button')).toHaveCount(14);
    await expect(nav.getByText('Matot', { exact: true })).toBeVisible();
    await expect(nav.getByText('Masei', { exact: true })).toBeVisible();
  });

  test('reads exactly the same verses either way, only grouped differently', async ({ page }) => {
    const unitsFor = async (mode: string): Promise<number> => {
      await setSettings(page, { doubleParsha: mode });
      await page.goto('/p/matot-masei');
      await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
      return page.locator('article[id^="unit-"]').count();
    };
    expect(await unitsFor('combined')).toBe(await unitsFor('separate'));
  });

  test('appears as its own row in the browse list, after both individual halves', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Numbers' }).click();
    const rows = page.locator('a[href^="/p/"]');
    await expect(page.locator('a[href="/p/matot-masei"]')).toBeVisible();
    await expect(page.getByText('Matot + Masei')).toBeVisible();

    const hrefs = await rows.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    const matot = hrefs.indexOf('/p/matot');
    const masei = hrefs.indexOf('/p/masei');
    const combo = hrefs.lastIndexOf('/p/matot-masei');
    expect(matot).toBeGreaterThanOrEqual(0);
    expect(masei).toBe(matot + 1);
    expect(combo).toBe(masei + 1);
  });
});

test.describe('Rashi fallback to Targum', () => {
  // Ki Tavo 26:6 has no Rashi comment under the current edition.
  const NO_RASHI_UNIT = '#unit-ki-tavo\\:26\\:6';

  test('reads Onkelos in place of a missing Rashi when Rashi is the third reading', async ({ page }) => {
    await setSettings(page, { targum: 'rashi', rashiFallbackToOnkelos: true });
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator(NO_RASHI_UNIT);
    await card.scrollIntoViewIfNeeded();

    await expect(card).toContainText('No Rashi here — Targum instead:');
    await expect(card).not.toContainText('No Rashi on this verse.');
    // The dot must reflect what is actually shown, not what was assigned.
    await expect(card.getByRole('button', { name: 'Onkelos 1 26:6' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Rashi 1 26:6' })).toHaveCount(0);
  });

  test('says there is no Rashi when the fallback is turned off', async ({ page }) => {
    await setSettings(page, { targum: 'rashi', rashiFallbackToOnkelos: false });
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator(NO_RASHI_UNIT);
    await card.scrollIntoViewIfNeeded();

    await expect(card).toContainText('No Rashi on this verse.');
    await expect(card.getByRole('button', { name: 'Rashi 1 26:6' })).toBeVisible();
  });

  test('never doubles up Onkelos when both readings are shown', async ({ page }) => {
    await setSettings(page, { targum: 'both', rashiFallbackToOnkelos: true });
    await page.goto(`/p/${PARSHA}`);
    const card = page.locator(NO_RASHI_UNIT);
    await card.scrollIntoViewIfNeeded();

    await expect(card).toContainText('No Rashi on this verse.');
    const text = await card.innerText();
    expect(text.match(/וְאַבְאִישׁוּ/gu)).toHaveLength(1);
  });

  test('the setting only appears when Rashi is the sole third reading', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Show Targum when Rashi is missing')).toHaveCount(0);

    await page.getByRole('radio', { name: 'Rashi', exact: true }).click();
    await expect(page.getByText('Show Targum when Rashi is missing')).toBeVisible();

    await page.getByRole('radio', { name: 'Onkelos and Rashi' }).click();
    await expect(page.getByText('Show Targum when Rashi is missing')).toHaveCount(0);
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
