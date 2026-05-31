import { test, expect } from "@playwright/test";

test.describe("Polla: nueva temporada", () => {
  test.skip("incrementar season resetea el leaderboard pero preserva historial", async ({ page }) => {
    // SKIPPED — necesita polla existente seedeada en fixture.
    // Antes de habilitar, crear un seed que insertaría una polla con
    // 3 partidas confirmadas en el setup global del e2e.

    await page.goto("/tournaments/polla-e2e-test");

    await expect(page.locator('text=Temporada 1')).toBeVisible();

    await page.click('button:has-text("Nueva temporada")');

    await expect(page.locator('text=Vas a empezar la Temporada 2')).toBeVisible();
    await page.fill('input[id="confirm-input"]', "nueva temporada");
    await page.click('button:has-text("Empezar Temporada 2")');

    await expect(page.locator('text=Temporada 2')).toBeVisible();
    // Standings reseteados — el primer row debería mostrar 0 puntos
    const firstRow = page.locator('[data-user-id]').first();
    await expect(firstRow.locator('text=/^0$/').first()).toBeVisible();
  });
});
