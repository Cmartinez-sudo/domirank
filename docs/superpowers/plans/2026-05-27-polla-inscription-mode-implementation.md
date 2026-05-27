# Polla Refactor: `inscription_mode='polla'` First-Class Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `'polla'` en un valor explícito del enum `tournaments.inscription_mode`, eliminando el patrón actual donde el wizard guardaba `'pre_formed'` y la UI hacía override con checks `format === 'polla'` en cada componente.

**Architecture:** Migration agrega `'polla'` al enum + cross-field constraint en DB. Schema TS acepta el nuevo valor. `createTournament` valida + auto-corrige cross-field. ManagePageClient branchea por `inscription_mode` (más natural para UI de management que `format`). Wizard step 6 auto-setea `inscription_mode='polla'` cuando `format='polla'`.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript, Tailwind, Zod, Vitest.

**Spec referencia:** `docs/superpowers/specs/2026-05-27-polla-inscription-mode-design.md`

**Branch:** `feat/polla` (extiende PR #11 antes del merge).

---

## File Structure

### Archivos a CREAR

| Path | Responsabilidad |
|------|-----------------|
| `domino-app/supabase/migrations/0042_polla_inscription_mode.sql` | Backfill + enum extension + cross-field CHECK |

### Archivos a MODIFICAR

| Path | Cambio |
|------|--------|
| `domino-app/src/lib/tournament-schema.ts` | Agregar `'polla'` al enum de `inscription_mode` |
| `domino-app/src/lib/__tests__/tournaments-schema.test.ts` | 2 tests nuevos (acepta polla, acepta los 3) |
| `domino-app/src/types/polla.ts` | Exportar `InscriptionMode` |
| `domino-app/src/lib/tournaments.ts` | Cross-field validation en createTournament |
| `domino-app/src/lib/tournament-formats-engine.ts` | Case `'polla'` early return en `generateInitialPairings` |
| `domino-app/src/components/polla/PollaConfigStep.tsx` | Mensaje "Las parejas se forman al armar cada partida" |
| `domino-app/src/app/tournaments/new/step-6/Step6Form.tsx` | Auto-set `inscription_mode='polla'` al continuar |
| `domino-app/src/app/tournaments/[id]/manage/ManagePageClient.tsx` | Branching por `inscription_mode` + nueva sección polla roster |

---

## Task 1: Migration 0042 — backfill + constraints

**Files:**
- Create: `domino-app/supabase/migrations/0042_polla_inscription_mode.sql`

- [ ] **Step 1: Crear el archivo de migration**

```sql
-- ============================================================
-- 0042 — inscription_mode='polla' como first-class
-- ============================================================
-- Refactor: 'polla' pasa a ser un valor explícito del enum
-- inscription_mode, en lugar de hacer override en UI con format='polla'.
-- Permite branching por inscription_mode en ManagePageClient.
--
-- Backfill primero, constraint después: si hay pollas existentes con
-- inscription_mode='pre_formed', el ADD CONSTRAINT cross-field las
-- rechazaría. El UPDATE las corrige antes del constraint.
-- ============================================================

-- 1. Backfill: pollas con inscription_mode='pre_formed' -> 'polla'
update public.tournaments
   set inscription_mode = 'polla'
 where format = 'polla' and inscription_mode <> 'polla';

-- 2. Drop old constraint y crear nuevo con 'polla' incluido
alter table public.tournaments
  drop constraint if exists tournaments_inscription_mode_check;

alter table public.tournaments
  add constraint tournaments_inscription_mode_check
  check (inscription_mode in ('pre_formed', 'individual_manual', 'polla'));

-- 3. Cross-field constraint: polla format iff polla inscription_mode
alter table public.tournaments
  drop constraint if exists tournaments_format_inscription_check;

alter table public.tournaments
  add constraint tournaments_format_inscription_check
  check (
    (format = 'polla' and inscription_mode = 'polla')
    or (format <> 'polla' and inscription_mode <> 'polla')
  );

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
--   select inscription_mode, count(*)
--     from public.tournaments
--    group by inscription_mode;
--   -- Debería incluir 'polla' si existen pollas
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conname in (
--      'tournaments_inscription_mode_check',
--      'tournaments_format_inscription_check'
--    );
--   -- Verificar las 2 definiciones nuevas
-- ============================================================
```

- [ ] **Step 2: Commit la migration**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/supabase/migrations/0042_polla_inscription_mode.sql
git commit -m "feat(polla): migration 0042 — inscription_mode='polla' enum + constraints"
```

NOTE: Aplicar 0042 manualmente en Supabase Dashboard ANTES de mergear el PR. Es idempotente. Si la DB todavía no tiene pollas, el UPDATE es un no-op pero los constraints sí se actualizan.

---

## Task 2: Schema TS — agregar 'polla' al enum + tests TDD

**Files:**
- Modify: `domino-app/src/lib/tournament-schema.ts`
- Modify: `domino-app/src/lib/__tests__/tournaments-schema.test.ts`

- [ ] **Step 1: Agregar tests fallidos primero**

En `domino-app/src/lib/__tests__/tournaments-schema.test.ts`, agregar antes del final del `describe` outer:

```ts
  // ── Polla inscription_mode ─────────────────────────────────
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
```

- [ ] **Step 2: Correr tests, verificar 2 nuevos fallan**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm test --run src/lib/__tests__/tournaments-schema.test.ts
```

Expected: 2 nuevos tests FAIL (enum solo acepta `pre_formed | individual_manual`).

- [ ] **Step 3: Modificar el schema**

En `domino-app/src/lib/tournament-schema.ts`, encontrar la línea con `inscription_mode: z.enum(...)` y cambiar:

```ts
  inscription_mode: z.enum(["pre_formed", "individual_manual", "polla"]),
```

- [ ] **Step 4: Correr tests, verificar todos pasan**

```bash
pnpm test --run src/lib/__tests__/tournaments-schema.test.ts
```

Expected: todos los tests pasan, incluyendo los 2 nuevos. El test existente "rechaza mexicano (deferred)" sigue pasando (mexicano no se agregó).

- [ ] **Step 5: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/lib/tournament-schema.ts domino-app/src/lib/__tests__/tournaments-schema.test.ts
git commit -m "feat(polla): schema acepta inscription_mode='polla'"
```

---

## Task 3: Tipos TS + cross-field validation en `createTournament`

**Files:**
- Modify: `domino-app/src/types/polla.ts`
- Modify: `domino-app/src/lib/tournaments.ts`

- [ ] **Step 1: Agregar `InscriptionMode` a types/polla.ts**

En `domino-app/src/types/polla.ts`, después de los types existentes (después de `PollaRoundGroup`), apender:

```ts

/** Modo de inscripción de un torneo. */
export type InscriptionMode = "pre_formed" | "individual_manual" | "polla";
```

- [ ] **Step 2: Agregar cross-field validation en createTournament**

En `domino-app/src/lib/tournaments.ts`, encontrar la línea después de `const f = parsed.data;` dentro de `createTournament`. Agregar inmediatamente después:

```ts
  // Cross-field guard: format='polla' iff inscription_mode='polla'.
  // Auto-corrige el caso de llamadas legacy del wizard pre-refactor
  // (format='polla' + inscription_mode='pre_formed'). El caso inverso
  // (inscription_mode='polla' sin format='polla') sí es error.
  const isPollaFormat = f.format === "polla";
  const isPollaInscription = f.inscription_mode === "polla";
  if (isPollaFormat && !isPollaInscription) {
    (f as { inscription_mode: typeof f.inscription_mode }).inscription_mode = "polla";
  } else if (!isPollaFormat && isPollaInscription) {
    return {
      ok: false as const,
      error: "inscription_mode='polla' sólo es válido para format='polla'.",
    };
  }
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/types/polla.ts domino-app/src/lib/tournaments.ts
git commit -m "feat(polla): tipo InscriptionMode + cross-field validation en createTournament"
```

---

## Task 4: tournament-formats-engine + Step6Form + PollaConfigStep

**Files:**
- Modify: `domino-app/src/lib/tournament-formats-engine.ts`
- Modify: `domino-app/src/app/tournaments/new/step-6/Step6Form.tsx`
- Modify: `domino-app/src/components/polla/PollaConfigStep.tsx`

- [ ] **Step 1: Agregar case 'polla' en generateInitialPairings**

En `domino-app/src/lib/tournament-formats-engine.ts`, dentro de `generateInitialPairings`, encontrar el bloque `if (format === "rotation" || format === "points_league")` (alrededor de línea 70) y agregar ANTES:

```ts
    if (format === "polla") {
      // Polla no tiene initial pairings — se crean per match desde
      // PollaHomePage via createNewMatchInPolla. Solo retornamos ok;
      // el caller actualiza tournaments.status='in_progress' aparte.
      return { ok: true };
    }
```

NOTE: si el código actual tiene un `if (format === "rotation" || format === "points_league") { return { ok: true }; }` (no auto pairings), este nuevo case va al lado siguiendo el mismo patrón.

- [ ] **Step 2: Modificar Step6Form para auto-set inscription_mode**

En `domino-app/src/app/tournaments/new/step-6/Step6Form.tsx`, encontrar el handler "Continuar" (función que llama a `router.push("/tournaments/new/step-7")`). Antes del push, agregar:

```ts
    // Auto-set inscription_mode='polla' cuando format='polla'. Garantiza
    // que llegamos a step-7 con el draft consistente con el cross-field
    // constraint del DB.
    const inscription_mode = draft.format === "polla" ? "polla" : draft.inscription_mode;
    setField({ inscription_mode, currentStep: 7 });
```

Si ya existe un `setField({ ... currentStep: 7 })`, mergear las propiedades en el mismo call.

NOTE: el shape exacto depende del file actual. READ primero la función handler completa antes de editar para ubicar la línea correcta. Si Step6Form tiene branching diferente para polla vs otros formatos, agregar el auto-set en el branch de polla.

- [ ] **Step 3: Agregar mensaje informativo en PollaConfigStep**

En `domino-app/src/components/polla/PollaConfigStep.tsx`, encontrar el bloque del heading (donde dice "¿Tiene fecha de fin?" o similar) y agregar debajo:

```tsx
        <p className="text-text-mute text-sm mt-1">
          Las parejas se forman al armar cada partida.
        </p>
```

El bloque final del heading debería quedar como:

```tsx
      <div>
        <h2 className="text-lg font-semibold mb-1">Configuración de la polla</h2>
        <p className="text-text-mute text-sm">¿Tiene fecha de fin?</p>
        <p className="text-text-mute text-sm mt-1">
          Las parejas se forman al armar cada partida.
        </p>
      </div>
```

- [ ] **Step 4: Build + typecheck**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck && pnpm build
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/lib/tournament-formats-engine.ts \
        domino-app/src/app/tournaments/new/step-6/Step6Form.tsx \
        domino-app/src/components/polla/PollaConfigStep.tsx
git commit -m "feat(polla): engine case + step 6 auto-set + mensaje informativo"
```

---

## Task 5: ManagePageClient — branching por inscription_mode

**Files:**
- Modify: `domino-app/src/app/tournaments/[id]/manage/ManagePageClient.tsx`

CRITICAL: READ el archivo completo primero (es ~450 líneas). Identificar las líneas exactas que mencionan `isPreFormed`, `unpairedPlayers`, y el bloque de error. El plan tiene los cambios pero usa números de línea aproximados — ajustar al shape real.

- [ ] **Step 1: Refactor de variables (cerca de línea 70)**

Encontrar la línea actual:
```tsx
const isPreFormed = tournament.inscription_mode === "pre_formed";
```

Reemplazar por:

```tsx
const isPolla = tournament.inscription_mode === "polla";
const isPreFormed = tournament.inscription_mode === "pre_formed";
const isManual = tournament.inscription_mode === "individual_manual";
```

Y en la declaración de props del componente (alrededor línea 46), cambiar `inscription_mode: string;` a `inscription_mode: InscriptionMode;` y agregar el import al inicio del archivo:

```tsx
import type { InscriptionMode } from "@/types/polla";
```

- [ ] **Step 2: Refactor de canStart (cerca de línea 87)**

Encontrar:
```tsx
const canStart = isOpen && pairs.length >= expectedPairs && unpairedPlayers.length === 0;
```

Reemplazar por:

```tsx
const canStart = isOpen && (
  isPolla
    ? players.length === tournament.max_players
    : pairs.length >= expectedPairs && unpairedPlayers.length === 0
);
```

- [ ] **Step 3: Guards en branches existentes**

Buscar todas las apariciones de `{isPreFormed && ` y reemplazar por `{isPreFormed && !isPolla && `. Si hay alguna que dice `{!isPreFormed && ` (línea ~282 del análisis original), reemplazar por `{isManual && `.

Verificación: después del refactor, ningún `{isPreFormed && ...}` debe quedar sin `&& !isPolla` agregado (excepto si el contexto ya excluye polla — caso raro).

Run:
```bash
grep -n "isPreFormed" domino-app/src/app/tournaments/[id]/manage/ManagePageClient.tsx
```

Cada match debe ser `isPreFormed && !isPolla` o `isPreFormed && pairs.length` (donde `pairs.length` siempre es 0 para polla, así que el render no se muestra). Es OK también si el match es parte de una expresión booleana donde polla queda excluida por otros motivos.

- [ ] **Step 4: Agregar nueva sección PollaRosterSection**

Encontrar el lugar lógico donde renderizar (después de los bloques de pairs/manual, antes de los CTAs de "Iniciar"). Probablemente entre las líneas 280 y 340. Agregar:

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
                    // TODO: handler removeFromTournament — funcionalidad pendiente.
                    onClick={() => setError("Quitar jugador: funcionalidad pendiente")}
                    className="text-text-mute text-sm hover:text-danger"
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>
          {players.length < tournament.max_players && isOpen && (
            <button
              type="button"
              // TODO: handler openAddPlayerModal — funcionalidad pendiente.
              onClick={() => setError("Agregar jugador: funcionalidad pendiente")}
              className="btn-secondary w-full"
            >
              + Agregar jugador
            </button>
          )}
        </section>
      )}
```

CRITICAL: verificar que `Avatar` ya está importado en el archivo. Si no:

```tsx
import { Avatar } from "@/components/Avatar";
```

Verificar también que `setError` existe en el scope (debería, ManagePageClient maneja errors). Si no existe, agregar `const [error, setError] = useState<string | null>(null);` al inicio del componente (o reusar la state existente del archivo).

- [ ] **Step 5: Actualizar el error message del canStart fallido (cerca de línea 409)**

Encontrar el bloque que dice algo como:

```tsx
: isPreFormed
  ? `Faltan parejas: ${unpairedPlayers.length} jugadores sin partner.`
  : `Faltan jugadores: ...`
```

Modificar para incluir el caso polla ANTES:

```tsx
: isPolla
  ? `Faltan ${tournament.max_players - players.length} jugadores.`
  : isPreFormed
  ? `Faltan parejas: ${unpairedPlayers.length} jugadores sin partner.`
  : `Faltan jugadores: ${tournament.max_players - players.length}.`
```

- [ ] **Step 6: Typecheck + build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck && pnpm build
```

Expected: green.

- [ ] **Step 7: Smoke test mental**

Ejecutar mentalmente:
- Polla con `inscription_mode='polla'`, 2 players de 4: muestra "Inscritos: 2/4" + lista, no muestra UI de "Sin partner", botón "Iniciar polla" deshabilitado (canStart false: players.length !== max_players).
- Polla con 4 players de 4: muestra "Inscritos: 4/4", botón habilitado.
- Pre_formed: muestra UI de parejas como antes (sin cambios visibles).
- Individual_manual: muestra UI de jugadores sin parejas como antes.

- [ ] **Step 8: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/app/tournaments/[id]/manage/ManagePageClient.tsx
git commit -m "feat(polla): ManagePageClient branchea por inscription_mode + nueva sección polla roster"
```

---

## Task 6: Final validation + push

- [ ] **Step 1: Full validation**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck && pnpm test --run && pnpm build
```

Expected: 3 verde. Tests: 340 + 2 (Task 2) = 342.

- [ ] **Step 2: Verificar no hay regresiones obvias en tests**

```bash
pnpm test --run 2>&1 | grep -E "(FAIL|PASS|Tests)"
```

Expected: 342 tests pasando, sin FAIL.

- [ ] **Step 3: Push**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git push
```

CI corre en `feat/polla` y el PR #11 se actualiza automáticamente con los nuevos commits.

- [ ] **Step 4: Verificar Vercel preview**

```bash
gh pr view 11 --comments --json comments --jq '.comments[-1].body' | grep -oE 'https://domirank-[a-z0-9-]+\.vercel\.app'
```

Expected: URL del preview deploy. Esperar build verde antes de validar visualmente.

- [ ] **Step 5: Smoke test visual en preview**

En el preview deploy:
1. Ir a `/tournaments/new/step-1`, crear polla nueva.
2. Confirmar que step 6 muestra "Las parejas se forman al armar cada partida".
3. Después de crear, ir a `/tournaments/[id]/manage`.
4. Confirmar que muestra "Inscritos: X/4" + lista + "Iniciar polla", SIN UI de "Sin partner".
5. Confirmar que `/tournaments/[id]/manage/pair` redirige a `/manage`.
6. Probar también crear un torneo Swiss para confirmar que NO se rompió.

---

## Self-Review

### Spec coverage check

| Sección del spec | Task que cubre |
|------------------|----------------|
| §3 Migration 0042 | Task 1 |
| §4 Schema TS + Types | Tasks 2, 3 |
| §5 Wizard step 6 | Task 4 (PollaConfigStep + Step6Form) |
| §6 createTournament server action | Task 3 |
| §7 tournament-formats-engine | Task 4 |
| §8 ManagePageClient | Task 5 |
| §9 pair page (no cambios) | N/A (intencional) |
| §10 Tests | Task 2 (schema tests) — Task 3 no agrega test pero la lógica es defensive |
| §11 Acceptance criteria | Distribuidos en steps "expected" de cada task |

### Placeholders / red flags

- Task 5 Step 3 dice "Verificación: después del refactor, ningún `{isPreFormed && ...}` debe quedar sin `&& !isPolla` agregado (excepto si el contexto ya excluye polla — caso raro)" — es una verificación, no un placeholder.
- Task 4 Step 2 dice "el shape exacto depende del file actual. READ primero" — esto es realista, no un placeholder. El plan provee el código exacto a insertar; lo que varía es la ubicación dentro del archivo.
- TODO comments dentro del código nuevo en Task 5 Step 4 (handlers removeFromTournament/openAddPlayerModal): documentados en el spec sección 14 como "follow-up commit" — NO bloquean este refactor, son intencionalmente diferidos.

### Type consistency

- `InscriptionMode` definido en Task 3, usado en Task 5 (ManagePageClient props).
- `isPolla / isPreFormed / isManual` consistentes en Task 5 steps 1, 2, 3, 4, 5.
- `f.inscription_mode = "polla"` en Task 3 — el cast `as { inscription_mode: typeof f.inscription_mode }` es necesario porque `f` es readonly desde el schema, pero la mutación es deliberada para auto-corregir.

### Riesgos identificados (del spec §13)

- Drafts en localStorage: el auto-set en Step 6 los corrige al pasar.
- Cross-field constraint: el orden secuencial en la migration (UPDATE → ADD CONSTRAINT) lo arregla.
- Snapshot de `isManual` cambia el branching de `!isPreFormed` a `isManual` — verificado en Task 5 Step 3.

### Diferido / no incluido

- Handlers reales de `removeFromTournament` y `openAddPlayerModal` — follow-up commit.
- Tests del cross-field validation en `createTournament` — el plan los menciona pero no los implementa para mantener el scope chico. Si querés cobertura adicional, agregar como step 6 en Task 3.
- E2E tests del flow polla en `/manage` — los E2E existentes están como `.skip()`; sin cambios.
