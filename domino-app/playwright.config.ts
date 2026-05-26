import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for DomiRank e2e tests.
 *
 * NOTE: These tests run locally only. CI requires either a dedicated
 * Supabase testing project or mocked auth. Do NOT add e2e to the
 * GitHub Actions workflow (.github/workflows/ci.yml) without that setup.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
