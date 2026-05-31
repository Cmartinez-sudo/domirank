import { test, expect } from "@playwright/test";

test.describe("Polla: crear y jugar", () => {
  test.skip("flujo completo desde login hasta leaderboard actualizado", async ({ page }) => {
    // SKIPPED — necesita login helper alineado con el patrón del proyecto.
    // Antes de habilitar, leer un e2e existente para encontrar el helper
    // de login establecido (e.g., en e2e/back-navigation.spec.ts o similar).
    // Si no hay helper, agregarlo a e2e/helpers.ts.

    await page.goto("/login");
    await page.fill('input[name="email"]', "test@domirank.test");
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD ?? "test-password");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard$/);

    // Crear polla
    await page.goto("/tournaments/new/step-1");
    await page.fill('input[name="name"]', "Polla E2E " + Date.now());
    await page.click('button:has-text("Continuar")');

    // Step 3 — format polla
    await page.click('label:has-text("Polla")');
    await page.click('button:has-text("Continuar")');

    // Step 4 — modality
    await page.click('label:has-text("Venezolano")');
    await page.click('button:has-text("Continuar")');

    // Step 5 — player count 4 (presets [4,6,8] para polla)
    await page.click('button:has-text("4")');
    await page.click('button:has-text("Continuar")');

    // Step 6 — polla config (indefinida)
    await page.click('label:has-text("Indefinida")');
    await page.click('button:has-text("Continuar")');

    // Step 7 — participantes
    for (const name of ["erik", "gibbon", "gusi"]) {
      await page.fill('input[placeholder*="Buscar"]', name);
      await page.click(`button:has-text("${name}")`);
    }
    await page.click('button:has-text("Continuar")');

    // Step 9 — resumen (skipea 8 automáticamente)
    await expect(page.locator('text=Polla (liga continua)')).toBeVisible();
    await expect(page.locator('text=Indefinida')).toBeVisible();
    await page.click('button:has-text("Crear torneo")');

    // Llega a la polla home
    await expect(page.locator('text=Polla')).toBeVisible();
    await expect(page.locator('text=Temporada 1')).toBeVisible();

    // Tap "Nueva partida"
    await page.click('button:has-text("Nueva partida")');

    // Modal: armar pairings
    await page.locator('select').nth(1).selectOption({ label: "Erik" });
    await page.locator('select').nth(2).selectOption({ label: "Gibbon" });
    await page.locator('select').nth(3).selectOption({ label: "Gusi" });
    await page.click('button:has-text("Empezar partida")');

    // Llegamos a /matches/[id]/live
    await expect(page).toHaveURL(/\/matches\/.+\/live$/);
  });
});
