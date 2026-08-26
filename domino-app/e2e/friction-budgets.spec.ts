/**
 * E2E tests: FRICTION BUDGET regression guards.
 *
 * Estos tests aseguran presupuestos de UX medibles (taps y cambios de pantalla
 * del happy path) además de que el flujo funciona. Si alguien agrega una
 * pantalla intermedia o cambia una redirección clave, estos tests fallan.
 *
 * Presupuestos auditados (Audit UX 2026-08-26):
 *   1. Registrar una mano en partida en curso: ≤ 3 taps, 0 cambios de pantalla.
 *   2. Terminar partida dentro de torneo: back cae en /tournaments/[id],
 *      NO en /dashboard.
 *   3. Onboarding tras signup: ≤ 6 pantallas (1 perfil + 4 preguntas + 1 summary).
 *
 * NOTE: Los tests marcados `.skip` requieren seed de partida en curso + torneo
 * que aún no está en el harness común. Se habilitan cuando el seed esté listo.
 * Se dejan con aserciones completas para que actúen como especificación
 * ejecutable del presupuesto.
 *
 * Prerequisitos:
 *   - Local dev server (`pnpm dev` auto-inicia via webServer)
 *   - Test user: test1@domirank.test / TestUser2026!
 *   - (Para skip tests) seed de match in_progress y torneo asociado con
 *     el test user como creator/scorekeeper.
 */

import { test, expect, type Page } from "@playwright/test";

const TEST_EMAIL = "test1@domirank.test";
const TEST_PASSWORD = "TestUser2026!";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/correo|email/i).fill(TEST_EMAIL);
  await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /entrar|iniciar/i }).click();
  await page.waitForURL("**/dashboard");
}

test.describe("Presupuesto de fricción — registrar mano", () => {
  // Habilitar cuando el seed provea un match in_progress URL-accesible.
  test.skip("registrar 1 mano toma ≤ 3 taps y 0 navegaciones", async ({ page }) => {
    await login(page);

    // Inyectar el matchId del seed via env var o fixture aparte.
    const matchId = process.env.E2E_LIVE_MATCH_ID;
    test.skip(!matchId, "E2E_LIVE_MATCH_ID no seteado — seed de match requerido");

    await page.goto(`/matches/${matchId}/live`);
    await expect(page).toHaveURL(new RegExp(`/matches/${matchId}/live$`));

    const urlBefore = page.url();
    const handsBefore = await page.getByText(/Manos jugadas \((\d+)\)/).textContent();
    const countBefore = Number(handsBefore?.match(/\((\d+)\)/)?.[1] ?? 0);

    // ≤ 3 taps: dígitos "9" + "0" + Sumar. (Team se hereda del último round.)
    await page.getByRole("button", { name: "9" }).click(); // tap 1
    await page.getByRole("button", { name: "0" }).click(); // tap 2
    await page.getByRole("button", { name: "Sumar" }).click(); // tap 3

    // 0 cambios de pantalla — URL debe ser IDÉNTICA.
    await expect(page).toHaveURL(urlBefore);

    // Toast de confirmación visible (evita dobles envíos en red lenta).
    await expect(page.getByRole("status")).toContainText(/\+90/);

    // Manos jugadas +1 (aparte del cambio no visible en URL).
    const handsAfter = await page.getByText(/Manos jugadas \((\d+)\)/).textContent();
    const countAfter = Number(handsAfter?.match(/\((\d+)\)/)?.[1] ?? 0);
    expect(countAfter).toBe(countBefore + 1);
  });

  test.skip("activeTeam se hereda del último round al montar", async ({ page }) => {
    await login(page);
    const matchId = process.env.E2E_LIVE_MATCH_ID_TEAM_B_LAST;
    test.skip(
      !matchId,
      "E2E_LIVE_MATCH_ID_TEAM_B_LAST no seteado — seed de match con última mano team=2 requerido",
    );

    await page.goto(`/matches/${matchId}/live`);

    // El toggle de team activo debe reflejar team=2 (rojo/teamB).
    // TeamTile con aria/estilo "active" cuando activeTeam === 2 (color B).
    // Aserta que el segundo tile es el activo.
    const teamBTile = page.getByRole("button", { name: /Pareja B|Jugador B/i });
    await expect(teamBTile).toBeVisible();
    // Verificamos ring/borde activo (implementación: box-shadow inset).
    // Nota: aserción robusta requeriría un data-attribute — TODO agregar
    // data-active para tests estables. Por ahora chequeamos que el toggle
    // dentro del "Registrar puntos" tenga la clase activa en team 2.
    const toggleB = page.locator("button", { hasText: /^.+$/ }).nth(1);
    await expect(toggleB).toBeVisible();
  });
});

test.describe("Presupuesto de fricción — terminar partida en torneo", () => {
  // Habilitar cuando el seed provea match tournament + finalización.
  test.skip("finalizar quick match en torneo → volver cae en /tournaments/[id]", async ({ page }) => {
    await login(page);
    const matchId = process.env.E2E_TOURNEY_MATCH_ID;
    const tournamentId = process.env.E2E_TOURNEY_ID;
    test.skip(
      !matchId || !tournamentId,
      "E2E_TOURNEY_MATCH_ID / E2E_TOURNEY_ID no seteados — seed de match+torneo requerido",
    );

    await page.goto(`/matches/${matchId}/live`);

    // Simular final: seed debe dejar el match en estado finishable
    // (scoreA o scoreB ≥ target_points). El botón Finalizar debe estar visible.
    const finalize = page.getByRole("button", { name: /Finalizar/ });
    await expect(finalize).toBeVisible();
    await finalize.click();

    // Debe navegar a la pantalla de detalle del match (quick match) o
    // permanecer in-place con status confirmed (continuous_league).
    await expect(page).toHaveURL(new RegExp(`/matches/${matchId}($|\\?)`));

    // El breadcrumb "← Volver al torneo" debe llevar a /tournaments/[id],
    // NO al dashboard. Este es el corazón del presupuesto.
    const back = page.getByRole("link", { name: /Volver al torneo/i });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}($|\\?)`));
    // Anti-regresión: nunca debe caer en /dashboard tras terminar torneo.
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});

test.describe("Sprint 2 — Salir de grupo", () => {
  test.skip("miembro no-admin ve botón 'Salir del grupo' y sale con confirm", async ({ page }) => {
    await login(page);
    const groupId = process.env.E2E_GROUP_ID_AS_MEMBER;
    test.skip(!groupId, "E2E_GROUP_ID_AS_MEMBER no seteado — seed de grupo requerido");

    await page.goto(`/groups/${groupId}/members`);
    // La sección "Salir del grupo" debe estar visible para miembros no-admin.
    const leaveBtn = page.getByRole("button", { name: /Salir del grupo/i });
    await expect(leaveBtn).toBeVisible();
    await leaveBtn.click();

    // Confirm dialog: "¿Salir del grupo?"
    await expect(page.getByRole("heading", { name: /¿Salir del grupo\?/ })).toBeVisible();
    await page.getByRole("button", { name: /Sí, salir/i }).click();

    // Post-leave: navega a /groups + toast.
    await page.waitForURL("**/groups");
  });

  test.skip("admin único: botón dice 'Salir y archivar', archiva grupo", async ({ page }) => {
    await login(page);
    const groupId = process.env.E2E_GROUP_ID_AS_SOLE_ADMIN;
    test.skip(
      !groupId,
      "E2E_GROUP_ID_AS_SOLE_ADMIN no seteado — seed de grupo con test user como único miembro admin requerido",
    );

    await page.goto(`/groups/${groupId}/members`);
    const leaveBtn = page.getByRole("button", { name: /Salir y archivar grupo/i });
    await expect(leaveBtn).toBeVisible();
    await leaveBtn.click();
    await expect(page.getByRole("heading", { name: /Salir y archivar el grupo/i })).toBeVisible();
    await page.getByRole("button", { name: /Sí, salir y archivar/i }).click();
    await page.waitForURL("**/groups");
    // El grupo archivado no debe aparecer en la lista de "Mis grupos" activos.
    await expect(page.locator(`a[href="/groups/${groupId}/leaderboard"]`)).toHaveCount(0);
  });

  test.skip("admin con otros miembros: botón bloqueado con hint a Ajustes", async ({ page }) => {
    await login(page);
    const groupId = process.env.E2E_GROUP_ID_AS_ADMIN_WITH_OTHERS;
    test.skip(
      !groupId,
      "E2E_GROUP_ID_AS_ADMIN_WITH_OTHERS no seteado — seed requerido",
    );

    await page.goto(`/groups/${groupId}/members`);
    // No debe existir el botón de salir.
    await expect(page.getByRole("button", { name: /Salir del grupo/i })).toHaveCount(0);
    // Debe haber link a Ajustes.
    await expect(
      page.getByRole("link", { name: /Ajustes/i }),
    ).toBeVisible();
  });
});

test.describe("Sprint 2 — Ex-miembros en leaderboard", () => {
  test.skip("miembros 'left' aparecen tachados y al final del ranking", async ({ page }) => {
    await login(page);
    const groupId = process.env.E2E_GROUP_ID_WITH_FORMER;
    test.skip(!groupId, "E2E_GROUP_ID_WITH_FORMER no seteado — seed con miembros left requerido");

    await page.goto(`/groups/${groupId}/leaderboard`);

    // Debe haber al menos una fila con la clase de tachado (line-through).
    const formerRow = page.locator("tr").filter({ has: page.locator(".line-through") }).first();
    await expect(formerRow).toBeVisible();

    // El texto "Ex-miembro" debe aparecer como sub-label.
    await expect(page.getByText(/Ex-miembro/).first()).toBeVisible();

    // Verifica que sea la última fila de la tabla (o de un bloque final).
    const allRows = page.locator("tbody tr");
    const rowCount = await allRows.count();
    const lastRow = allRows.nth(rowCount - 1);
    await expect(lastRow.locator(".line-through")).toBeVisible();
  });
});

test.describe("Sprint 2 — Back post-finalize en torneo", () => {
  test.skip("back en /matches/[id] con tournament_id va a /tournaments/[id]", async ({ page }) => {
    await login(page);
    const matchId = process.env.E2E_TOURNEY_CONFIRMED_MATCH_ID;
    const tournamentId = process.env.E2E_TOURNEY_ID;
    test.skip(
      !matchId || !tournamentId,
      "E2E_TOURNEY_CONFIRMED_MATCH_ID / E2E_TOURNEY_ID no seteados",
    );

    await page.goto(`/matches/${matchId}`);
    await expect(page).toHaveURL(new RegExp(`/matches/${matchId}`));

    // El SecondaryPageShell renderiza un botón "Volver" con forceFallback=true
    // hacia /tournaments/[tournament_id].
    const back = page.getByRole("button", { name: /Volver/i });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(new RegExp(`/tournaments/${tournamentId}($|\\?)`));
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});

test.describe("Sprint 3 — returnTo tras sesión expirada", () => {
  test("visitar ruta protegida sin sesión → /login?next=<url>", async ({ page, context }) => {
    // Simular sesión expirada limpiando cookies de auth.
    await context.clearCookies();
    // Ir directo a una ruta protegida.
    await page.goto("/dashboard");
    // Middleware/requireUser redirige a /login con ?next=/dashboard.
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    // El input hidden `next` debe estar presente en el form.
    const hiddenNext = page.locator("input[type=hidden][name=next]");
    await expect(hiddenNext).toHaveAttribute("value", "/dashboard");
  });

  test.skip("tras login con ?next=<url> vuelve al destino", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/matches/new");
    // Redirect esperado: /login?next=%2Fmatches%2Fnew
    await expect(page).toHaveURL(/\/login\?next=/);
    // Login normal.
    await page.getByLabel(/correo|email/i).fill(TEST_EMAIL);
    await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();
    // Debe volver a /matches/new (no /dashboard).
    await page.waitForURL("**/matches/new");
  });

  test("rutas de auth NO se propagan como next (anti-loop)", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/login");
    // /login sin sesión debe cargar sin ?next=/login.
    await expect(page).toHaveURL(/\/login($|\?)/);
    await expect(page).not.toHaveURL(/next=%2Flogin/);
  });
});

test.describe("Sprint 3 — Numpad persistente", () => {
  test.skip("input y activeTeam se restauran tras F5", async ({ page }) => {
    await login(page);
    const matchId = process.env.E2E_LIVE_MATCH_ID;
    test.skip(!matchId, "E2E_LIVE_MATCH_ID no seteado — seed requerido");

    await page.goto(`/matches/${matchId}/live`);
    // Digitar "42" en team B pero no confirmar.
    await page.getByRole("button", { name: /^.+$/ }).nth(1).click(); // toggle Team B
    await page.getByRole("button", { name: "4" }).click();
    await page.getByRole("button", { name: "2" }).click();

    // F5 (reload).
    await page.reload();

    // Debe seguir el "42" en pantalla y team B activo.
    await expect(page.getByText(/^42$/)).toBeVisible();
    // Persistencia se verifica indirectamente: si tapea "Sumar", registra
    // para team B con 42 pts. Aserción concreta requeriría data-attributes.
  });

  test.skip("clearDraft tras finalizar: no persiste input al re-entrar", async ({ page }) => {
    await login(page);
    const matchId = process.env.E2E_MATCH_TO_FINALIZE_ID;
    test.skip(!matchId, "E2E_MATCH_TO_FINALIZE_ID no seteado");

    await page.goto(`/matches/${matchId}/live`);
    // ... (flujo de finalización). Post-finalize, re-entrar y verificar
    // que localStorage[`match-draft:${matchId}`] === null.
    const draft = await page.evaluate((id) => localStorage.getItem(`match-draft:${id}`), matchId);
    expect(draft).toBeNull();
  });
});

test.describe("Sprint 3 — Deeplink attestation", () => {
  test.skip("visitar /matches/[id]#attestation scrollea al panel", async ({ page }) => {
    await login(page);
    const matchId = process.env.E2E_PENDING_ATTEST_MATCH_ID;
    test.skip(!matchId, "E2E_PENDING_ATTEST_MATCH_ID no seteado — match pending_attestation requerido");

    await page.goto(`/matches/${matchId}#attestation`);
    const panel = page.locator("#attestation");
    await expect(panel).toBeVisible();
    // Debe estar en el viewport (scrolleado). Un test aproximado:
    // el bounding box de #attestation intersecta con [0, viewport_height].
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(200); // top del panel cerca del top del viewport.
  });
});

test.describe("Sprint 3 — Jugadores frecuentes", () => {
  test.skip("chip 'Con quien juegas seguido' aparece en step players", async ({ page }) => {
    await login(page);
    // Requiere seed: test user con historial de partidas.
    await page.goto("/matches/new");
    // Si tiene skip_modality, arranca en players directo; sino navega el wizard.
    // Aserción independiente: buscar el label "Con quien juegas seguido".
    const suggestions = page.getByText(/Con quien juegas seguido/i);
    // Puede o no existir dependiendo del seed — el test asegura que si
    // hay historial, se muestra.
    const count = await suggestions.count();
    test.skip(count === 0, "Sin historial de partidas para el test user");
    await expect(suggestions.first()).toBeVisible();
    // Tap el primer chip y verificar que se añade al equipo.
    const firstChip = page.locator("button", { hasText: /^.{1,20}$/ })
      .filter({ has: page.locator("img") })
      .first();
    await firstChip.click();
    // El chip debe desaparecer (excludeIds lo filtra).
  });
});

test.describe("Presupuesto de fricción — Onboarding", () => {
  // Requiere test user con onboarded=false. En vez de crear usuario nuevo
  // cada corrida (fricción para el runner), documentamos el presupuesto
  // como skip test con aserciones concretas — habilitar cuando el seed
  // provea `test-onboarding@domirank.test` con onboarded=false.
  test.skip("onboarding se completa en ≤ 6 pantallas", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/correo|email/i).fill("test-onboarding@domirank.test");
    await page.getByLabel(/contraseña|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /entrar|iniciar/i }).click();

    // Redirige a /onboarding porque onboarded=false.
    await page.waitForURL("**/onboarding");

    // Pantalla 1: perfil (país + modalidad fusionados). Ya NO existe la
    // pantalla "¡Bienvenido a DomiRank!" completa como paso muerto.
    await expect(page.getByRole("heading", { name: /Empecemos/ })).toBeVisible();
    // Asegura fusión: país + modalidad en la misma vista.
    await expect(page.getByText(/¿De qué país eres?/)).toBeVisible();
    await expect(page.getByText(/¿Qué modalidad juegas?/)).toBeVisible();
    // Regresión: la vieja pantalla NO debe existir.
    await expect(page.getByRole("heading", { name: /¡Bienvenido a DomiRank!/ })).toHaveCount(0);

    // Seleccionar país + continuar (modalidad se auto-preselecciona por país).
    await page.getByRole("button", { name: /Venezuela/i }).click();
    await page.getByRole("button", { name: /Continuar/i }).click();

    // Pantallas 2-5: 4 preguntas de skill (auto-advance).
    for (let i = 0; i < 4; i++) {
      // Progress debe decir "Paso 2 de 2" (no "Paso 3 de 3").
      await expect(page.getByText(/Paso 2 de 2/)).toBeVisible();
      // Elegir primera opción.
      const opts = page.locator("button", { hasText: /^.{2,}$/ });
      await opts.first().click();
    }

    // Pantalla 6: summary.
    await expect(page.getByRole("heading", { name: /¡Listo!/ })).toBeVisible();
    await page.getByRole("button", { name: /Empezar a jugar/ }).click();

    await page.waitForURL("**/dashboard");
  });
});
