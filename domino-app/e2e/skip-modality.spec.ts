/**
 * E2E test: skip modality prompt flow — US-05.
 *
 * IMPORTANT: This test requires migration 0034 (user_preferences table) to be
 * applied. If the migration has not been run, the test will fail because
 * getUserPreferences() will error and the preferences won't persist.
 * Run `supabase db push` or apply the migration manually before running this test.
 *
 * Prerequisites:
 *   - Local dev server running (pnpm dev)
 *   - Migration 0034 applied (user_preferences table exists)
 *   - Test user: test1@domirank.test / TestUser2026!
 *
 * Run: pnpm e2e --grep "skip modality"
 */

import { test, expect } from "@playwright/test";

const TEST_EMAIL = "test1@domirank.test";
const TEST_PASSWORD = "TestUser2026!";

test.describe("Skip modality prompt — US-05", () => {
  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    await page.waitForURL("**/dashboard");
  });

  test("activar skip → segunda partida salta modalidad → badge Cambiar → override puntual", async ({
    page,
  }) => {
    // ── Step 1: ir a /matches/new ──────────────────────────────────────────
    await page.goto("/matches/new");

    // Debería estar en el step de modalidad (flow normal inicial)
    await expect(
      page.getByText(/No volver a preguntar esta modalidad/),
    ).toBeVisible({ timeout: 10_000 });

    // ── Step 2: elegir Venezolano ──────────────────────────────────────────
    // Venezolano debería estar seleccionado por defecto para el test user venezolano
    // Si no, seleccionarlo explícitamente
    const venLabel = page.locator("label").filter({ hasText: /Venezolano/ });
    await venLabel.click();

    // ── Step 3: tildar el checkbox "No volver a preguntar" ─────────────────
    const checkbox = page.getByRole("checkbox", {
      name: /No volver a preguntar/i,
    });
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // ── Step 4: Continuar al step de jugadores ─────────────────────────────
    await page.getByRole("button", { name: /continuar/i }).click();

    // Verificar que estamos en el step de jugadores
    await expect(
      page.getByRole("button", { name: /iniciar partida en vivo/i }),
    ).toBeVisible({ timeout: 5_000 });

    // ── Step 5: salir de /matches/new ─────────────────────────────────────
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);

    // ── Step 6: volver a /matches/new ─────────────────────────────────────
    await page.goto("/matches/new");

    // ── Step 7: verificar que saltó el step de modalidad ──────────────────
    // El step de jugadores debe mostrarse directamente
    await expect(
      page.getByRole("button", { name: /iniciar partida en vivo/i }),
    ).toBeVisible({ timeout: 10_000 });

    // El checkbox "No volver a preguntar" NO debe estar visible
    await expect(
      page.getByText(/No volver a preguntar esta modalidad/),
    ).not.toBeVisible();

    // ── Step 8: verificar badge "Modalidad: Venezolano · Cambiar" ─────────
    const badge = page.getByTestId("modality-skip-badge");
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("Venezolano");

    const changeBtn = page.getByTestId("change-modality-btn");
    await expect(changeBtn).toBeVisible();

    // ── Step 9: click "Cambiar" ────────────────────────────────────────────
    await changeBtn.click();

    // ── Step 10: verificar que aparece el step de modalidad ───────────────
    await expect(
      page.getByText(/No volver a preguntar esta modalidad/),
    ).toBeVisible({ timeout: 5_000 });

    // ── Step 11: elegir Dominicano + Continuar ────────────────────────────
    const domLabel = page.locator("label").filter({ hasText: /Dominicano/ });
    await domLabel.click();

    await page.getByRole("button", { name: /continuar/i }).click();

    // ── Step 12: verificar step de jugadores con Dominicano ───────────────
    await expect(
      page.getByRole("button", { name: /iniciar partida en vivo/i }),
    ).toBeVisible({ timeout: 5_000 });

    // El badge debería NO estar visible ahora (el user eligió activamente via override)
    await expect(page.getByTestId("modality-skip-badge")).not.toBeVisible();

    // ── Step 13: verificar que la próxima visita aún hace skip con Venezolano
    // (el override puntual NO cambió la DB)
    await page.goto("/dashboard");
    await page.goto("/matches/new");

    await expect(
      page.getByRole("button", { name: /iniciar partida en vivo/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Badge debe mostrar Venezolano (la modalidad guardada en DB, no el override)
    await expect(page.getByTestId("modality-skip-badge")).toContainText(
      "Venezolano",
    );
  });
});
