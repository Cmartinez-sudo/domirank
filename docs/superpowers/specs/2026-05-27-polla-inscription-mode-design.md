# Polla — Refactor `inscription_mode='polla'` First-Class

**Fecha:** 2026-05-27
**Owner:** Carlos Martínez
**Estado:** Brainstorm aprobado, listo para writing-plans
**Branch de trabajo:** `feat/polla` (extiende PR #11 antes del merge)
**Referencias:** `docs/superpowers/specs/2026-05-27-polla-design.md` (implementación original)

---

## 1. Propósito

Convertir `'polla'` en un valor explícito del enum `tournaments.inscription_mode`, eliminando el patrón actual donde el wizard guardaba `inscription_mode='pre_formed'` para todas las pollas y la UI hacía override con checks `format === 'polla'` en cada componente.

**Problema concreto que resuelve**: hoy `ManagePageClient` renderiza UI de "invitar partner" (válida solo para `pre_formed`) en pollas porque el branching por `format` no llegó a esa página. Con este refactor, el branching es por `inscription_mode` (que es el campo natural para decidir UI de management) y queda consistente.

---

## 2. Decisiones cerradas

| # | Decisión | Valor |
|---|----------|-------|
| 1 | Valores del enum | `('pre_formed', 'individual_manual', 'polla')` |
| 2 | `'mexicano'` | **NO se agrega** en este refactor. Sigue deferred (test explícito lo rechaza). |
| 3 | Cross-field constraint | DB-level CHECK + validación en server action (defense in depth). |
| 4 | Backfill | Las pollas existentes con `inscription_mode='pre_formed'` se UPDATEan a `'polla'` ANTES del ADD CONSTRAINT, en la misma migration. |
| 5 | Wizard step 6 | Opción A: cuando `format='polla'`, el step muestra mensaje informativo + el `is_open_ended` toggle existente. Al continuar, auto-setea `inscription_mode='polla'`. |
| 6 | Step 6 layout para polla | Reusa el `PollaConfigStep` actual con un mensaje agregado: "Las parejas se forman al armar cada partida." |
| 7 | `createTournament` server action | Auto-corrige cuando `format='polla'` y `inscription_mode` viene distinto (defensive). Rechaza cross-field mismatch en el caso contrario. |
| 8 | tournament-formats-engine | `generateInitialPairings` agrega case `'polla'` que retorna `{ ok: true }` sin crear pairings. Las pairings se crean per-match desde `PollaHomePage` → `createNewMatchInPolla`. |
| 9 | Manage UI para polla | Sección "Inscritos X/max" + lista plana de jugadores + "+ Agregar jugador" + "Iniciar polla". Sin UI de "Sin partner" ni "invitar partner". |
| 10 | "Iniciar polla" | Cambia `tournaments.status = 'in_progress'`, NO genera pairings, redirige a `/tournaments/[id]`. |

---

## 3. Modelo de datos — Migration `0042_polla_inscription_mode.sql`

```sql
-- ============================================================
-- 0042 — inscription_mode='polla' como first-class
-- ============================================================
-- Refactor: 'polla' pasa a ser un valor explícito del enum, en lugar
-- de hacer override en UI con format='polla'. Permite branching por
-- inscription_mode en ManagePageClient (que es el campo natural para
-- decidir UI de management).
--
-- Backfill primero, constraint después: si hay pollas existentes con
-- inscription_mode='pre_formed', el ADD CONSTRAINT cross-field las
-- rechazaría. El UPDATE las corrige antes del constraint.
-- ============================================================

-- Backfill: pollas con inscription_mode='pre_formed' → 'polla'
update public.tournaments
   set inscription_mode = 'polla'
 where format = 'polla' and inscription_mode <> 'polla';

-- Drop old constraint y crear nuevo con 'polla' incluido
alter table public.tournaments
  drop constraint if exists tournaments_inscription_mode_check;

alter table public.tournaments
  add constraint tournaments_inscription_mode_check
  check (inscription_mode in ('pre_formed', 'individual_manual', 'polla'));

-- Cross-field constraint: polla format ⇔ polla inscription_mode
alter table public.tournaments
  drop constraint if exists tournaments_format_inscription_check;

alter table public.tournaments
  add constraint tournaments_format_inscription_check
  check (
    (format = 'polla' and inscription_mode = 'polla')
    or (format <> 'polla' and inscription_mode <> 'polla')
  );
```

Idempotente. Aplicar manualmente en Supabase Dashboard después del merge.

---

## 4. Schema TypeScript

`src/lib/tournament-schema.ts`:

```ts
inscription_mode: z.enum(["pre_formed", "individual_manual", "polla"]),
```

`src/types/polla.ts` agrega:

```ts
export type InscriptionMode = "pre_formed" | "individual_manual" | "polla";
```

ManagePageClient props refactor:

```ts
type Props = {
  tournament: {
    // ...
    inscription_mode: InscriptionMode;  // antes: string
  };
};
```

---

## 5. Wizard step 6

`Step6Form.tsx` ya tiene branching `draft.format === 'polla' ? <PollaConfigStep> : ...`. Cambios:

1. En `PollaConfigStep.tsx`, agregar línea informativa abajo del heading existente: *"Las parejas se forman al armar cada partida."*
2. En el handler de "Continuar" del step 6, auto-setear `inscription_mode='polla'` cuando es polla:
   ```ts
   const inscription_mode = draft.format === "polla" ? "polla" : draft.inscription_mode;
   setField({ inscription_mode, currentStep: 7 });
   ```

Para los otros formatos, el inscription_mode sigue siendo elegible (UI no cambia).

---

## 6. createTournament server action

`src/lib/tournaments.ts` agrega validación cross-field después del Zod safeParse:

```ts
const f = parsed.data;
const isPollaFormat = f.format === "polla";
const isPollaInscription = f.inscription_mode === "polla";

if (isPollaFormat && !isPollaInscription) {
  // Auto-corrige llamadas legacy del wizard pre-refactor
  (f as { inscription_mode: typeof f.inscription_mode }).inscription_mode = "polla";
} else if (!isPollaFormat && isPollaInscription) {
  return {
    ok: false as const,
    error: "inscription_mode='polla' sólo es válido para format='polla'.",
  };
}
```

El insert ya pasa `inscription_mode: f.inscription_mode` — funciona sin cambios después de la auto-corrección.

---

## 7. tournament-formats-engine

`generateInitialPairings` (en `src/lib/tournament-formats-engine.ts`) agrega case temprano:

```ts
if (format === "polla") {
  // Polla no tiene initial pairings — se crean per match desde
  // PollaHomePage via createNewMatchInPolla. Solo actualizar status.
  return { ok: true };
}
```

Antes del dispatch existente que asume rotation/round_robin/swiss/single_elim/double_elim.

---

## 8. ManagePageClient — branching por `inscription_mode`

7 cambios en `src/app/tournaments/[id]/manage/ManagePageClient.tsx`:

### Refactor de variables (línea ~70)

```tsx
const isPolla = tournament.inscription_mode === "polla";
const isPreFormed = tournament.inscription_mode === "pre_formed";
const isManual = tournament.inscription_mode === "individual_manual";
```

### canStart (línea ~87)

```tsx
const canStart = isOpen && (
  isPolla
    ? players.length === tournament.max_players
    : pairs.length >= expectedPairs && unpairedPlayers.length === 0
);
```

### Branches existentes que ahora excluyen polla

Cualquier render que asume "pre_formed con parejas" debe excluir polla. Buscar `{isPreFormed && ...}` y reemplazar por `{isPreFormed && !isPolla && ...}`. Líneas afectadas:
- ~188 (bloque "Parejas pre-formadas")
- ~197 (lista de parejas)
- ~234 (lista de "Sin partner")
- ~344 (CTA para invitar)

Y la línea ~282 (`{!isPreFormed && players.length > 0 && ...}`) ahora debe ser `{isManual && players.length > 0 && ...}` (sin polla ahí — polla tiene su propia sección).

### Nueva sección para `isPolla`

Bloque nuevo a renderizar cuando `isPolla`:

```tsx
{isPolla && (
  <section className="card space-y-3">
    <div className="text-text-mute text-xs uppercase tracking-wide">
      Inscritos: {players.length} / {tournament.max_players}
    </div>
    <div className="divide-y divide-border">
      {players.map((p) => (
        <div key={p.id} className="flex items-center justify-between py-2.5">
          <span className="flex items-center gap-2">
            <Avatar player={p} size={28} />
            <span className="font-medium">{p.display_name ?? p.username}</span>
          </span>
          {isOpen && p.id !== tournament.created_by && (
            <button
              type="button"
              onClick={() => removeFromTournament(p.id)}
              className="text-text-mute text-sm hover:text-danger"
            >
              Quitar
            </button>
          )}
        </div>
      ))}
    </div>
    {players.length < tournament.max_players && isOpen && (
      <button type="button" onClick={openAddPlayerModal} className="btn-secondary w-full">
        + Agregar jugador
      </button>
    )}
  </section>
)}
```

### Error de canStart (línea ~409)

```tsx
: isPolla
  ? `Faltan ${tournament.max_players - players.length} jugadores.`
  : isPreFormed
  ? `Faltan parejas: ${unpairedPlayers.length} jugadores sin partner.`
  : `Faltan jugadores: ${tournament.max_players - players.length}.`
```

---

## 9. pair page — sin cambios

`src/app/tournaments/[id]/manage/pair/page.tsx` línea 24:

```ts
if (tournament.inscription_mode !== "individual_manual") redirect(`/tournaments/${id}/manage`);
```

Ya funciona correctamente: polla tiene `inscription_mode='polla'` ≠ `'individual_manual'` → redirige a `/manage`. Sin código a tocar.

---

## 10. Tests

### Schema test (`src/lib/__tests__/tournaments-schema.test.ts`)

```ts
it("acepta inscription_mode='polla' con format='polla'", () => {
  const parsed = createTournamentSchema.safeParse({
    ...VALID_BASE,
    format: "polla",
    inscription_mode: "polla",
  });
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.inscription_mode).toBe("polla");
});

it("acepta los 3 inscription_modes válidos", () => {
  for (const m of ["pre_formed", "individual_manual", "polla"] as const) {
    expect(createTournamentSchema.safeParse({ ...VALID_BASE, inscription_mode: m }).success).toBe(true);
  }
});

it("rechaza inscription_mode='mexicano' (deferred)", () => {
  // este test existe — debe seguir pasando
});
```

### Server action test (nuevo file o append a `polla-actions.test.ts`)

```ts
describe("createTournament — cross-field validation", () => {
  it("auto-corrige inscription_mode cuando format=polla pero inscription_mode=pre_formed", () => {
    // Verifica que el server action acepta y normaliza
  });

  it("rechaza inscription_mode=polla con format=swiss", async () => {
    // mock supabase, assert error.message
  });
});
```

(Implementación detallada al expandir el plan; los tests requieren mock del client.)

### ManagePageClient — no se snapshot-testea (sigue el patrón del proyecto).

---

## 11. Acceptance criteria

- [ ] Migration 0042 aplicada en Supabase sin errores
- [ ] Backfill: SELECT confirma que toda polla existente tiene `inscription_mode='polla'`
- [ ] Wizard step 6 con format=polla muestra `PollaConfigStep` + mensaje "Las parejas se forman al armar cada partida"
- [ ] Step 6 auto-setea `inscription_mode='polla'` al continuar
- [ ] Step 9 summary muestra `inscription_mode='polla'` correctamente (o lo omite — irrelevante para polla)
- [ ] `/tournaments/[id]/manage` con `inscription_mode='polla'` muestra: "Inscritos X/max" + lista plana + "Iniciar polla". SIN UI de "Sin partner" ni "invitar partner"
- [ ] `/tournaments/[id]/manage/pair` redirige a `/manage` cuando `inscription_mode='polla'`
- [ ] `createTournament(format='polla', inscription_mode='pre_formed')` → auto-corrige a polla y crea exitoso
- [ ] `createTournament(format='swiss', inscription_mode='polla')` → rechaza con error claro
- [ ] Tap "Iniciar polla" cambia `status='in_progress'`, NO genera tournament_pairings, redirige a `/tournaments/[id]`
- [ ] `select count(*) from tournament_pairings where tournament_id='<polla-id>'` retorna 0 inmediatamente después de iniciar
- [ ] Crear nueva partida desde PollaHomePage SÍ genera la fila en tournament_pairings (vía createNewMatchInPolla)
- [ ] Formatos no-polla (swiss, single_elim, round_robin) siguen funcionando sin regresión
- [ ] `pnpm build` limpio sin TS errors
- [ ] Tests passing (≥ 340 + nuevos)

---

## 12. Steps post-merge

Aplicar manualmente en Supabase Dashboard:

```
supabase/migrations/0042_polla_inscription_mode.sql
```

O `cd domino-app && supabase db push`.

---

## 13. Riesgos conocidos

1. **Drafts en localStorage del wizard**: si un usuario dejó el wizard a la mitad con `format='polla'` + `inscription_mode='pre_formed'` (legacy), al continuar el step 6 ahora auto-setea `inscription_mode='polla'`. Sin breakage; el draft se corrige solo.
2. **Cross-field constraint DB**: si la migration corre antes del backfill por error, fallará. La migration es secuencial dentro del mismo archivo SQL — primero UPDATE, luego ADD CONSTRAINT. Riesgo bajo.
3. **`isManual` snapshot**: la línea ~282 cambia de `!isPreFormed` a `isManual` explícito. Verificar manualmente que no rompa ninguna lógica para casos edge (e.g., torneo con valor inválido de inscription_mode — no debería existir gracias al constraint).

---

## 14. Lo que NO entra en este refactor

- **`mexicano` como inscription_mode**: deferred. Se agregaría en otra migration cuando se necesite.
- **Refactor del PollaConfigStep**: el toggle "indefinida vs cerrada con N rondas" sigue como está. Slider de N rondas sigue deferred.
- **UI de "Quitar jugador" funcional**: el botón "Quitar" se renderiza pero el handler `removeFromTournament` puede no existir todavía. Si no existe, agregar un TODO comment en la línea y dejar el `onClick` vacío (o llamar a `setError("Funcionalidad pendiente")`). NO eliminar el botón — la presencia visual del UI es parte del refactor. Funcionalidad del handler queda como follow-up commit.
- **Tests E2E de polla**: ya existen como `.skip()` en `e2e/`. Sin cambios.
