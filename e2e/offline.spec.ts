import { expect, test } from '@playwright/test';

/**
 * The offline story is the whole reason the text is a static, versioned asset.
 * These run in the Chromium projects only — WebKit's service-worker support
 * under Playwright is unreliable, and the behaviour under test is not
 * browser-specific.
 */
test.describe('offline', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'service worker test');

  test('a parsha already read stays readable with no network', async ({ page, context }) => {
    await page.goto('/p/ki-tavo');
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();

    // Wait for the service worker to take control and finish precaching.
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active?.state !== 'activated') {
        await new Promise((resolve) => {
          reg.active?.addEventListener('statechange', resolve, { once: true });
        });
      }
    });
    // Re-request the data so the runtime CacheFirst rule stores it.
    await page.reload();
    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();

    await context.setOffline(true);
    await page.reload();

    await expect(page.locator('article[id^="unit-"]').first()).toBeVisible();
    await expect(page.locator('.hebrew').first()).toContainText('וְהָיָה');

    await context.setOffline(false);
  });

  test('registers a manifest and icons for installation', async ({ page }) => {
    await page.goto('/');
    const manifestHref = await page
      .locator('link[rel="manifest"]')
      .getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const res = await page.request.get(manifestHref ?? '');
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as {
      name: string;
      display: string;
      icons: { src: string; sizes: string }[];
    };
    expect(manifest.name).toBe('Shnayim Mikra');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    for (const icon of manifest.icons) {
      const iconRes = await page.request.get(`/${icon.src.replace(/^\//u, '')}`);
      expect(iconRes.ok(), `icon ${icon.src}`).toBe(true);
    }
  });

  test('serves the Hebrew font it preloads', async ({ page }) => {
    await page.goto('/');
    const res = await page.request.get('/fonts/noto-serif-hebrew.woff2');
    expect(res.ok()).toBe(true);
    expect(Number(res.headers()['content-length'] ?? 0)).toBeGreaterThan(1000);
  });
});
