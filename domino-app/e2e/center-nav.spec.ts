/**
 * E2E test: center nav button (domino tile) in bottom nav.
 *
 * IMPORTANT: This test runs locally only.
 * CI requires a dedicated Supabase testing project or mocked auth.
 * Do NOT add this to .github/workflows/ci.yml without that setup.
 *
 * Prerequisites:
 *   - Local dev server running (or `pnpm dev` auto-started via webServer config)
 *   - Test user: test1@domirank.test / TestUser2026!
 */

import { test, expect } from "@playwright/test";

const TEST_EMAIL = "test1@domirank.test";
const TEST_PASSWORD = "TestUser2026!";

test.describe("Center nav button — domino tile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    await page.waitForURL("**/dashboard");
  });

  test("center button has aria-label='Nueva partida'", async ({ page }) => {
    const btn = page.getByRole("link", { name: "Nueva partida" });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("aria-label", "Nueva partida");
  });

  test("tap center button navigates to /matches/new", async ({ page }) => {
    const btn = page.getByRole("link", { name: "Nueva partida" });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page).toHaveURL(/\/matches\/new/, { timeout: 5_000 });
  });
});
