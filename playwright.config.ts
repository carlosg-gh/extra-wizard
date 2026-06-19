import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Smoke-tests the *production* build served under the GitHub Pages base path,
// so base-path regressions (which would break the deployed site) are caught.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/extra-wizard/`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm build:app && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/extra-wizard/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
