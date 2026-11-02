import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build served by `vite preview`.
 * Viewports: iPhone 14 Pro Max, a small iPhone, and Amazon Fire HD 10 (portrait and landscape).
 * Locally only Chromium is available; CI also runs the iPhone project in WebKit.
 */
const iosUA = devices['iPhone 14 Pro Max'].userAgent;
const fireUA =
  'Mozilla/5.0 (Linux; Android 11; KFTRWI) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// Chromium in CI has no GPU; this flag lets WebGL run on its software renderer.
const chromiumLaunch = { args: ['--enable-unsafe-swiftshader'] };
const projects = [
  { name: 'iphone-14-pro-max', use: { browserName: 'chromium' as const, launchOptions: chromiumLaunch, viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: iosUA } },
  { name: 'iphone-se', use: { browserName: 'chromium' as const, launchOptions: chromiumLaunch, viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: iosUA } },
  { name: 'fire-hd-10-portrait', use: { browserName: 'chromium' as const, launchOptions: chromiumLaunch, viewport: { width: 800, height: 1280 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, userAgent: fireUA } },
  { name: 'fire-hd-10-landscape', use: { browserName: 'chromium' as const, launchOptions: chromiumLaunch, viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, userAgent: fireUA } },
];
if (process.env.E2E_WEBKIT) {
  projects.push({ name: 'iphone-webkit', use: { ...devices['iPhone 14 Pro Max'], browserName: 'webkit' } } as unknown as (typeof projects)[number]);
}

export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'allow',
  },
  projects,
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
