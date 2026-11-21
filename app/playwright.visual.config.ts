import { defineConfig, devices } from '@playwright/test';

// Local-only visual regression suite (#48): baselines are win32 WebGL output,
// so it is not part of `test:e2e` nor CI. Run `npm run build` first: the
// webServer serves the `dist` build.
export default defineConfig({
  testDir: './tests/visual',
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  expect: { timeout: 30_000, toHaveScreenshot: { maxDiffPixelRatio: 0.001 } },
  use: {
    baseURL: 'http://localhost:4173',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4173',
          localStorage: [{ name: 'galaxy-map-welcome-dismissed', value: '1' }],
        },
      ],
    },
  },
  projects: [{ name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
