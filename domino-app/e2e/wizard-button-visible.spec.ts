/**
 * E2E test: botón "Continuar" visible sin scroll en el wizard de torneo.
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

// Viewports spec: iPhone SE 2da gen
const IPHONE_SE = { width: 375, height: 667 };

test.describe("Wizard — botón Continuar visible sin scroll", () => {
  test.use({ viewport: IPHONE_SE });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    await page.waitForURL("**/dashboard");
  });

  test("step 1 — botón Continuar visible en viewport 375×667 sin scroll", async ({ page }) => {
    await page.goto("/tournaments/new/step-1");

    // Si aparece el modal de borrador, descartarlo o continuar
    const draftModal = page.getByRole("dialog");
    const hasDraft = await draftModal.isVisible({ timeout: 2_000 }).catch(() => false);
    if (hasDraft) {
      // Intentar cerrar el modal (botón "Nuevo" o "Descartar")
      const discardBtn = page.getByRole("button", { name: /nuevo|descartar|empezar/i });
      if (await discardBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await discardBtn.click();
      }
    }

    // Esperar a que cargue el step 1
    await page.waitForSelector("input#tournament-name", { timeout: 10_000 });

    // El botón "Continuar" debe ser visible sin scroll
    const continueButton = page.getByRole("button", { name: /continuar/i });
    await expect(continueButton).toBeVisible({ timeout: 5_000 });
    await expect(continueButton).toBeInViewport();
  });

  test("step 1 — botón Continuar permanece visible al abrir teclado (dvh)", async ({ page }) => {
    await page.goto("/tournaments/new/step-1");

    await page.waitForSelector("input#tournament-name", { timeout: 10_000 });

    // Simular focus en el input (abre teclado en mobile)
    const input = page.locator("input#tournament-name");
    await input.click();
    await input.type("Torneo test");

    // Botón sigue visible tras interacción con input
    const continueButton = page.getByRole("button", { name: /continuar/i });
    await expect(continueButton).toBeVisible({ timeout: 3_000 });
    await expect(continueButton).toBeInViewport();
  });
});
