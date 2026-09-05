/**
 * E2E test: botón central "Crear" (+) del bottom nav mobile.
 *
 * Nueva UX: el (+) NO navega directo — abre un BottomSheet con acciones
 * (Nueva partida, Crear torneo, Crear grupo). El usuario elige y navega.
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

test.describe("FAB Crear (+) — bottom nav mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 Pro

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    await page.waitForURL("**/dashboard");
  });

  test("el botón (+) tiene aria-label='Crear' y aria-haspopup='menu'", async ({ page }) => {
    const btn = page.getByRole("button", { name: "Crear" });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("aria-haspopup", "menu");
    await expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  test("tap en (+) abre el sheet con 3 acciones y NO navega", async ({ page }) => {
    const url = page.url();
    const btn = page.getByRole("button", { name: "Crear" });
    await btn.click();
    // El botón cambia aria-expanded a true.
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    // El sheet aparece como dialog.
    const sheet = page.getByRole("dialog", { name: "Crear" });
    await expect(sheet).toBeVisible();
    // Contiene los 3 links.
    await expect(sheet.getByRole("link", { name: /nueva partida/i })).toBeVisible();
    await expect(sheet.getByRole("link", { name: /crear torneo/i })).toBeVisible();
    await expect(sheet.getByRole("link", { name: /crear grupo/i })).toBeVisible();
    // La URL no cambió.
    expect(page.url()).toBe(url);
  });

  test("tap en 'Nueva partida' desde el sheet navega a /matches/new", async ({ page }) => {
    await page.getByRole("button", { name: "Crear" }).click();
    const sheet = page.getByRole("dialog", { name: "Crear" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("link", { name: /nueva partida/i }).click();
    await expect(page).toHaveURL(/\/matches\/new/, { timeout: 5_000 });
  });

  test("tap fuera del sheet lo cierra", async ({ page }) => {
    const btn = page.getByRole("button", { name: "Crear" });
    await btn.click();
    await expect(page.getByRole("dialog", { name: "Crear" })).toBeVisible();
    // Click en el backdrop.
    await page.locator('[aria-hidden="true"].fixed').first().click({ force: true });
    await expect(page.getByRole("dialog", { name: "Crear" })).toBeHidden();
    await expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape cierra el sheet", async ({ page }) => {
    const btn = page.getByRole("button", { name: "Crear" });
    await btn.click();
    await expect(page.getByRole("dialog", { name: "Crear" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Crear" })).toBeHidden();
  });
});
