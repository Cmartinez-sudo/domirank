/**
 * E2E test: back navigation via AppHeader.
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

test.describe("Back navigation via AppHeader", () => {
  test.beforeEach(async ({ page }) => {
    // Log in via the login form
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard");
  });

  test("navegar a perfil de amigo desde lista → tap back → vuelve a /friends", async ({ page }) => {
    // Navigate to friends list
    await page.goto("/friends");
    await expect(page).toHaveURL(/\/friends/);

    // Find a friend card with a profile link and click it
    const profileLink = page.locator("a[href^='/profile/']").first();
    await expect(profileLink).toBeVisible({ timeout: 10_000 });
    await profileLink.click();

    // Should be on a profile page
    await expect(page).toHaveURL(/\/profile\//);

    // AppHeader back button should be present
    const backBtn = page.getByRole("button", { name: "Volver" });
    await expect(backBtn).toBeVisible();

    // Click back
    await backBtn.click();

    // Should return to /friends (same origin referrer → router.back())
    await expect(page).toHaveURL(/\/friends/, { timeout: 5_000 });
  });
});
