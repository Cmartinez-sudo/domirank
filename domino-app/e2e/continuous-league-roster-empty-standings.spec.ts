import { test, expect } from "@playwright/test";

/**
 * Regression test del bug "modal nueva partida sin opciones de jugadores".
 *
 * Setup esperado: polla recién iniciada con 4 jugadores, SIN partidas
 * confirmadas todavía. Es el happy path inicial:
 *   crear polla → iniciar → tap "+ Nueva partida" → ver 4 jugadores → jugar.
 *
 * El bug original (fixed en commit 78b2739): el modal derivaba el roster
 * de continuous_league_standings RPC, que filtra por matches confirmed. En
 * polla nueva sin partidas el roster venía vacío y los <select> no tenían
 * opciones — feature 100% roto.
 *
 * SKIPPED por ahora: igual que los otros e2e del proyecto, necesita
 * login helper + seed fixtures alineados. Habilitar cuando exista la
 * infra de seed para test users.
 */
test.describe("Polla: roster en modal de nueva partida (regresión)", () => {
  test.skip("polla recién iniciada — los 4 jugadores aparecen en los selectores", async ({ page }) => {
    // Setup (asume seed de polla `polla-e2e-regression` con 4 jugadores,
    // status='in_progress', cero partidas confirmadas):
    await page.goto("/tournaments/polla-e2e-regression");

    // Header debe verse
    await expect(page.locator('text=Temporada 1')).toBeVisible();
    await expect(page.locator('text=4 jugadores')).toBeVisible();

    // Abrir modal
    await page.click('button:has-text("Nueva partida")');

    // 4 selects esperados (a1, a2, b1, b2)
    const selects = page.locator('[role="dialog"] select');
    await expect(selects).toHaveCount(4);

    // Cada select debe tener al menos 5 options
    // (1 placeholder "— Elegir —" + 4 jugadores del roster)
    for (let i = 0; i < 4; i++) {
      const options = selects.nth(i).locator('option');
      await expect(options).toHaveCount(5);
    }

    // Verificar que los 4 nombres aparecen al menos una vez en el modal
    for (const name of ["Carlos", "Erik", "Gibbon", "Gusi"]) {
      await expect(page.locator(`[role="dialog"]`).getByText(name).first()).toBeVisible();
    }

    // Armar pairings y confirmar
    await selects.nth(1).selectOption({ label: "Erik" });
    await selects.nth(2).selectOption({ label: "Gibbon" });
    await selects.nth(3).selectOption({ label: "Gusi" });
    await page.click('button:has-text("Empezar partida")');

    // Redirige a la live match
    await expect(page).toHaveURL(/\/matches\/.+\/live$/);
  });
});
