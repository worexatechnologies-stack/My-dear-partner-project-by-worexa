import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const liveProfilePhotoE2E = process.env.PROFILE_PHOTO_LIVE_E2E === '1';
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH?.trim();

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: liveProfilePhotoE2E ? [] : ['**/*.live.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: `npx next dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
