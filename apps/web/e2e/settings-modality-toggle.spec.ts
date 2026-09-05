/**
 * E2E test: Settings toggle para modalidad por defecto — US-06.
 *
 * IMPORTANT: This test requires migration 0034 (user_preferences table) to be
 * applied before running. Without it, getUserPreferences() will error and
 * preferences won't persist.
 *
 * Prerequisites:
 *   - Local dev server running (pnpm dev)
 *   - Migration 0034 applied (user_preferences table exists)
 *   - Test user: test1@domirank.test / TestUser2026!
 *
 * Run: pnpm e2e --grep "settings modality"
 */

import { test, expect } from "@playwright/test";

const TEST_EMAIL = "test1@domirank.test";
const TEST_PASSWORD = "TestUser2026!";

test.describe("Settings modality toggle — US-06", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    await page.waitForURL("**/dashboard");
  });

  test("toggle OFF → dropdown aparece → elegir Dominicano → /matches/new salta modalidad", async ({
    page,
  }) => {
    // ── Step 1: ir a /settings ─────────────────────────────────────────────
    await page.goto("/settings");

    // Verificar que aparece la sección
    await expect(
      page.getByText("Preferencias de partida"),
    ).toBeVisible({ timeout: 10_000 });

    // ── Step 2: asegurarse de que el toggle empiece en ON ──────────────────
    const toggle = page.getByTestId("modality-prompt-toggle");
    await expect(toggle).toBeVisible();

    // Si ya está OFF, encenderlo primero para partir de un estado conocido
    const ariaChecked = await toggle.getAttribute("aria-checked");
    if (ariaChecked === "false") {
      await toggle.click();
      await expect(page.getByText("Preferencias guardadas")).toBeVisible({ timeout: 5_000 });
    }

    // Confirmar toggle ON
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    // El dropdown NO debe estar visible cuando toggle ON
    await expect(
      page.getByTestId("default-modality-select"),
    ).not.toBeVisible();

    // ── Step 3: click en toggle → OFF ─────────────────────────────────────
    await toggle.click();

    // Toast de confirmación
    await expect(
      page.getByText("Preferencias guardadas"),
    ).toBeVisible({ timeout: 5_000 });

    // Toggle ahora OFF
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    // ── Step 4: verificar que aparece el dropdown ──────────────────────────
    const dropdown = page.getByTestId("default-modality-select");
    await expect(dropdown).toBeVisible({ timeout: 5_000 });

    // ── Step 5: elegir Dominicano ──────────────────────────────────────────
    await dropdown.selectOption("dom");

    // Toast de confirmación por el cambio de modalidad
    await expect(
      page.getByText("Preferencias guardadas"),
    ).toBeVisible({ timeout: 5_000 });

    // ── Step 6: navegar a /matches/new ────────────────────────────────────
    await page.goto("/matches/new");

    // ── Step 7: verificar que salta el step de modalidad ──────────────────
    // Debe ir directo al step de jugadores
    await expect(
      page.getByRole("button", { name: /iniciar partida en vivo/i }),
    ).toBeVisible({ timeout: 10_000 });

    // La pantalla de selección de modalidad NO debe estar visible
    await expect(
      page.getByText(/No volver a preguntar esta modalidad/),
    ).not.toBeVisible();

    // Badge debe mostrar "Dominicano"
    const badge = page.getByTestId("modality-skip-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("Dominicano");

    // ── Step 8 (opcional): volver a settings, toggle ON ───────────────────
    await page.goto("/settings");
    await expect(page.getByText("Preferencias de partida")).toBeVisible({ timeout: 10_000 });

    const toggle2 = page.getByTestId("modality-prompt-toggle");
    await toggle2.click();

    await expect(page.getByText("Preferencias guardadas")).toBeVisible({ timeout: 5_000 });
    await expect(toggle2).toHaveAttribute("aria-checked", "true");

    // Dropdown debe desaparecer
    await expect(
      page.getByTestId("default-modality-select"),
    ).not.toBeVisible();

    // ── Step 9: verificar que /matches/new vuelve a pedir modalidad ────────
    await page.goto("/matches/new");
    await expect(
      page.getByText(/No volver a preguntar esta modalidad/),
    ).toBeVisible({ timeout: 10_000 });
  });
});
