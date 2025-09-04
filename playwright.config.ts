import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const envObj: { [k: string]: string } | undefined = process.env.MONGODB_URI
  ? { MONGODB_URI: process.env.MONGODB_URI, MONGODB_DB: process.env.MONGODB_DB || 'nextjs_dashboard' }
  : undefined;

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  timeout: 30_000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    headless: true,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
  command: process.env.PLAYWRIGHT_DEV_COMMAND || 'PORT=3000 pnpm dev',
  url: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    // Only inject MONGODB_URI into the web server environment when it's defined locally.
  env: envObj,
  reuseExistingServer: true,
    timeout: 120_000,
  },
});
