/**
 * E2E test: FriendCard navigation + Remove friend flow.
 *
 * IMPORTANT: This test MODIFIES real DB state.
 *   - Precondition: test1@domirank.test must have test2 as a friend.
 *   - The test removes that friendship.
 *   - To re-run: re-add test2 as friend from test1's profile, then run again.
 *
 * Prerequisites:
 *   - Local dev server running (pnpm dev)
 *   - test1@domirank.test / TestUser2026! must exist
 *   - test2 must exist with a known username (set TEST2_USERNAME below)
 *   - test1 must already be friends with test2 before running
 *
 * IMPORTANT: Do NOT add to CI without a seeded test DB that resets between runs.
 */

import { test, expect } from "@playwright/test";

const TEST_EMAIL    = "test1@domirank.test";
const TEST_PASSWORD = "TestUser2026!";
// Update this to the actual username of the test2 account in your dev DB.
const TEST2_USERNAME = "test2";

test.describe("FriendCard clickeable + Remove friend from profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    await page.waitForURL("**/dashboard");
  });

  test("tap FriendCard → navega al perfil del amigo", async ({ page }) => {
    await page.goto("/friends");
    await expect(page).toHaveURL(/\/friends/);

    // FriendCard is now a single <a> wrapping the whole card
    const friendCard = page.locator(`a[href="/profile/${TEST2_USERNAME}"]`).first();
    await expect(friendCard).toBeVisible({ timeout: 10_000 });

    // Verify the card link has the correct aria-label pattern
    const ariaLabel = await friendCard.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/Ver perfil de/i);

    await friendCard.click();
    await expect(page).toHaveURL(new RegExp(`/profile/${TEST2_USERNAME}`));
  });

  test("tap 'Quitar amigo' en perfil → ConfirmDialog → confirmar → redirect a /friends sin el amigo", async ({ page }) => {
    // Navigate directly to test2's profile
    await page.goto(`/profile/${TEST2_USERNAME}`);
    await expect(page).toHaveURL(new RegExp(`/profile/${TEST2_USERNAME}`));

    // The "Quitar amigo" button should be visible (only shown when friends)
    const removeBtn = page.getByRole("button", { name: "Quitar amigo" });
    await expect(removeBtn).toBeVisible({ timeout: 10_000 });

    await removeBtn.click();

    // ConfirmDialog should open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Verify dialog title contains the friend's name
    await expect(dialog).toContainText("Quitar a");

    // Click the confirm "Quitar amigo" button inside the dialog
    const confirmBtn = dialog.getByRole("button", { name: "Quitar amigo" });
    await confirmBtn.click();

    // Should redirect to /friends after success
    await expect(page).toHaveURL(/\/friends/, { timeout: 10_000 });

    // The removed friend should no longer appear in the friends tab
    const removedCard = page.locator(`a[href="/profile/${TEST2_USERNAME}"]`);
    await expect(removedCard).not.toBeVisible({ timeout: 5_000 });
  });
});
