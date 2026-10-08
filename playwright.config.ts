import { defineConfig, devices } from '@playwright/test';

/** e2e runs against a build that bundles data/fixtures (SPEC §5.6), served by vite preview. */
const BASE_URL = 'http://localhost:4173/tangocho/';
const CI = process.env.CI !== undefined;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run build:e2e && npm run preview:e2e',
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
