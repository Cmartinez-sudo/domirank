import { test, expect } from '@playwright/test';

/**
 * E2E test del flujo completo Club Pro.
 *
 * Estado: SKIPPED hasta que tengamos:
 *   1. Una org de testing en la DB de preview (no prod).
 *   2. Un user de testing con rol owner/admin de esa org.
 *   3. Un mock o intercept para Resend (los emails de invitación no
 *      deben salir de verdad durante el test).
 *   4. Credenciales en `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`.
 *
 * Por qué skipped: este flujo crea data (org → torneo → invitations →
 * users → matches), y correrlo contra prod sería destructivo. La
 * alternativa correcta es un proyecto Supabase de testing, que requiere
 * setup que excede el scope de Fase 7.
 *
 * Carlos: cuando quieras habilitar:
 *   a) Crear proyecto Supabase de testing (free tier).
 *   b) Aplicar TODAS las migrations al proyecto de testing:
 *        supabase link --project-ref <testing-ref>
 *        supabase db push --linked
 *   c) Setear `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 *      en `.env.test.local` apuntando al testing project.
 *   d) Seed: una org + un user owner + RESEND_API_KEY=dummy (para que
 *      sendEmail retorne false sin throw).
 *   e) Cambiar el `test.skip` por `test` y correr `pnpm playwright test
 *      club-pro-full-flow.spec.ts`.
 *
 * Mientras tanto, los integration tests de
 * `src/lib/club-pro/__tests__/full-tournament-flow.test.ts` cubren el
 * engine end-to-end (4 rondas, byes, withdrawal, CE tiebreak) sin
 * requerir infra.
 */
test.describe('Club Pro: flujo completo', () => {
  test.skip('crear torneo → invitar → claim → jugar 2 rondas → finalizar', async ({
    page,
  }) => {
    const ts = Date.now();
    const tournamentName = `E2E Tournament ${ts}`;
    const orgSlug = process.env.E2E_ORG_SLUG ?? 'test-club';

    // ── 1. Admin login ──
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL ?? 'admin@test.local');
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD ?? 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard$/);

    // ── 2. Crear torneo desde /admin/org/[slug] ──
    await page.goto(`/admin/org/${orgSlug}`);
    await expect(page.locator('h1')).toBeVisible();
    await page.click('a:has-text("Crear torneo")');
    await page.waitForURL(/\/tournaments\/new$/);

    // Step 1
    await page.fill('input[placeholder*="Copa"]', tournamentName);
    const startAt = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 16);
    await page.fill('input[type="datetime-local"]', startAt);
    await page.click('button:has-text("Siguiente")');

    // Step 2 (defaults OK)
    await page.click('button:has-text("Siguiente")');

    // Step 3: fill 4 pairs
    const pairs = [
      ['Alice', `alice-${ts}@e2e.test`, 'Bob', `bob-${ts}@e2e.test`],
      ['Carla', `carla-${ts}@e2e.test`, 'Daniel', `daniel-${ts}@e2e.test`],
      ['Eva', `eva-${ts}@e2e.test`, 'Felipe', `felipe-${ts}@e2e.test`],
      ['Gina', `gina-${ts}@e2e.test`, 'Hugo', `hugo-${ts}@e2e.test`],
    ];
    for (let i = 0; i < pairs.length; i++) {
      const inputs = page.locator(`li:nth-child(${i + 1}) input`);
      await inputs.nth(0).fill(pairs[i][0]);
      await inputs.nth(1).fill(pairs[i][1]);
      await inputs.nth(2).fill(pairs[i][2]);
      await inputs.nth(3).fill(pairs[i][3]);
    }
    await page.click('button:has-text("Siguiente")');

    // Step 4: confirm
    await expect(page.locator(`text=${tournamentName}`)).toBeVisible();
    await page.click('button:has-text("Crear torneo")');

    // Redirect to management screen
    await page.waitForURL(/\/admin\/org\/.+\/tournaments\/[a-f0-9-]+\/overview$/);

    // ── 3. Enviar invitaciones ──
    await page.click('button:has-text("Enviar invitaciones")');
    page.on('dialog', (d) => d.accept());
    await expect(page.locator('text=enviado')).toBeVisible({ timeout: 10_000 });

    // ── 4. Iniciar torneo ──
    await page.click('button:has-text("Iniciar torneo")');
    await expect(page.locator('text=En curso')).toBeVisible({ timeout: 10_000 });

    // ── 5. Tab Rondas → ingresar scores ──
    await page.click('a:has-text("Rondas")');
    // For each match in round 1, fill home/away scores so home wins.
    const cards = page.locator('[class*="Mesa"]'); // rough — depends on real UI markup
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const inputs = cards.nth(i).locator('input[type="number"]');
      await inputs.nth(0).fill('200');
      await inputs.nth(1).fill('100');
      await cards.nth(i).locator('button:has-text("Guardar")').click();
    }

    // ── 6. Generar siguiente ronda ──
    await page.click('a:has-text("Resumen")');
    await page.click('button:has-text("Generar siguiente")');
    await expect(page.locator('text=Ronda 2')).toBeVisible();

    // ── 7. Verificar display público ──
    const displaySlug = await page.locator('code:has-text("/t/")').textContent();
    if (displaySlug) {
      const publicPage = await page.context().newPage();
      await publicPage.goto(displaySlug.trim());
      await expect(publicPage.locator('text=EN VIVO')).toBeVisible();
      await publicPage.close();
    }

    // ── 8. Cerrar ronda 2 + finalizar torneo (igual que paso 5) ──
    // ...

    // ── 9. Verificar standings finales ──
    await page.click('a:has-text("Clasificación")');
    await expect(page.locator('table')).toBeVisible();
  });
});
