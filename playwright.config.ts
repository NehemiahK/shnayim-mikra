import { defineConfig, devices } from '@playwright/test';

const PORT = 4273;
const isCI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // `exactOptionalPropertyTypes` forbids an explicit undefined, so only set
  // `workers` when we actually want to pin it.
  ...(isCI ? { workers: 1 } : {}),
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'on-first-retry',
  },
  // The app is mobile-first, so the mobile projects are the primary signal.
  // WebKit is opt-in: it is the truest iOS Safari check, but its prebuilt
  // binary segfaults on some macOS/arm64 hosts. CI (Linux) sets PW_WEBKIT=1.
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    ...(process.env['PW_WEBKIT'] === '1'
      ? [{ name: 'ios', use: { ...devices['iPhone 12'] } }]
      : []),
  ],
  webServer: {
    // Preview the real production build, so the service worker and the
    // committed data files are exercised exactly as they ship.
    command: `npm run build && npx vite preview --port ${String(PORT)} --strictPort`,
    port: PORT,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
