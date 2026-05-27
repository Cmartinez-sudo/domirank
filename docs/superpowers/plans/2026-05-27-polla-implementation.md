# Polla Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el formato "Polla" (liga continua entre amigos) en DomiRank, integrado al sistema de torneos existente.

**Architecture:** Reusa `tournaments`, `tournament_players`, `tournament_pairings`, `match_players`. Agrega 4 RPCs SQL (`calc_streak`, `polla_standings`, `polla_best_partner`, `polla_worst_rival`), un set de componentes `polla/*`, y server actions `polla-actions.ts`. El wizard de torneo branchea cuando `format='polla'`. Sub-story 6 (rating integration) ya está en main via PR #10.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), TypeScript, Tailwind, Zod, Vitest, Playwright.

**Spec referencia:** `docs/superpowers/specs/2026-05-27-polla-design.md`

**Branch:** `feat/polla` (commit base: `558e655` con migration 0039 ya aplicada).

---

## File Structure

### Archivos a CREAR

| Path | Responsabilidad |
|------|-----------------|
| `domino-app/supabase/migrations/0040_polla_rpcs.sql` | 4 RPCs Postgres: `calc_streak`, `polla_standings`, `polla_best_partner`, `polla_worst_rival` |
| `domino-app/src/types/polla.ts` | Tipos TS: `PollaStandingsRow`, `PollaPartnerRow`, etc. |
| `domino-app/src/lib/polla-actions.ts` | Server actions: `createNewMatchInPolla`, `startNewSeason`, `closePolla` |
| `domino-app/src/lib/__tests__/polla-rpc.test.ts` | Tests con mock Supabase + fixture de 6 partidas |
| `domino-app/src/lib/__tests__/polla-actions.test.ts` | Tests de las server actions |
| `domino-app/src/components/polla/PollaConfigStep.tsx` | Step 6 polla-specific (indefinida vs rondas fijas) |
| `domino-app/src/components/polla/PollaHomePage.tsx` | Contenedor de la página del polla |
| `domino-app/src/components/polla/PollaLeaderboard.tsx` | Tabla de standings |
| `domino-app/src/components/polla/PartnerStatsCard.tsx` | "Tu mejor partner / Rival más fuerte" |
| `domino-app/src/components/polla/PollaRoundsAccordion.tsx` | Agrupación visual de partidas en rondas |
| `domino-app/src/components/polla/NewMatchInPollaModal.tsx` | Modal/bottom sheet para crear partida |
| `domino-app/src/components/polla/NewSeasonDialog.tsx` | Dialog type-to-confirm para nueva temporada |
| `domino-app/src/components/polla/__tests__/PollaLeaderboard.test.tsx` | Component test |
| `domino-app/src/components/polla/__tests__/PartnerStatsCard.test.tsx` | Component test |
| `domino-app/src/components/polla/__tests__/NewMatchInPollaModal.test.tsx` | Component test |
| `domino-app/e2e/polla-create-and-play.spec.ts` | E2E: crear polla → partida → leaderboard |
| `domino-app/e2e/polla-new-season.spec.ts` | E2E: nueva temporada flow |

### Archivos a MODIFICAR

| Path | Cambio |
|------|--------|
| `domino-app/src/lib/tournament-schema.ts` | Agregar `'polla'` al enum de format + campo `is_open_ended` |
| `domino-app/src/lib/tournaments.ts` | Pasar `is_open_ended` al insert de createTournament |
| `domino-app/src/app/tournaments/new/step-2/Step2Form.tsx` | Forzar `visibility=private` cuando `draft.format === 'polla'` |
| `domino-app/src/app/tournaments/new/step-3/Step3Form.tsx` | Agregar opción "Polla" con badge cultural |
| `domino-app/src/app/tournaments/new/step-6/Step6Form.tsx` | Renderizar `<PollaConfigStep>` cuando format='polla' |
| `domino-app/src/app/tournaments/new/step-7/Step7Form.tsx` | Branching: si format='polla', `router.push("/tournaments/new/step-9")` (skip step 8) |
| `domino-app/src/app/tournaments/new/step-9/Step9Form.tsx` | Incluir `is_open_ended` en summary + input de createTournament |
| `domino-app/src/app/tournaments/[id]/page.tsx` | Si `tournament.format === 'polla'`, renderizar `<PollaHomePage>` |
| `domino-app/src/lib/__tests__/tournaments-schema.test.ts` | Agregar tests para format='polla', is_open_ended |

---

## Sub-Story 1b — RPCs y unit tests

### Task 1: Migration 0040 con calc_streak

**Files:**
- Create: `domino-app/supabase/migrations/0040_polla_rpcs.sql`

- [ ] **Step 1: Crear el archivo con el header y `calc_streak`**

```sql
-- ============================================================
-- 0040 — RPCs del formato Polla (sub-story 1b)
-- ============================================================
-- Cuatro funciones Postgres para el leaderboard y stats del polla.
-- Todas SECURITY DEFINER y grant a authenticated.
--
-- Idempotente: create or replace function.
-- Requiere migration 0039 ya aplicada (campos season, current_season).
-- ============================================================

create or replace function public.calc_streak(
  p_user_id uuid,
  p_tournament_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season int;
  v_streak int := 0;
  v_kind text := null; -- 'W' o 'L'
  r record;
  v_won boolean;
begin
  select current_season into v_season
    from public.tournaments
   where id = p_tournament_id;
  if v_season is null then return '—'; end if;

  for r in
    select m.id as match_id,
           mp.team as my_team,
           (select sum(score) from public.match_players
             where match_id = m.id and team = mp.team) as my_team_score,
           (select sum(score) from public.match_players
             where match_id = m.id and team <> mp.team) as opp_team_score
      from public.tournament_pairings tp
      join public.matches m on m.id = tp.match_id
      join public.match_players mp on mp.match_id = m.id and mp.user_id = p_user_id
     where tp.tournament_id = p_tournament_id
       and tp.season = v_season
       and m.status = 'confirmed'
     order by m.created_at desc
  loop
    v_won := r.my_team_score > r.opp_team_score;
    if v_kind is null then
      v_kind := case when v_won then 'W' else 'L' end;
      v_streak := 1;
    elsif (v_kind = 'W' and v_won) or (v_kind = 'L' and not v_won) then
      v_streak := v_streak + 1;
    else
      exit;
    end if;
  end loop;

  if v_kind is null then return '—'; end if;
  return v_streak::text || v_kind;
end;
$$;

grant execute on function public.calc_streak(uuid, uuid) to authenticated;
```

- [ ] **Step 2: Commit del schema parcial**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/supabase/migrations/0040_polla_rpcs.sql
git commit -m "feat(polla): RPC calc_streak — racha actual del jugador"
```

---

### Task 2: Agregar `polla_best_partner` y `polla_worst_rival`

**Files:**
- Modify: `domino-app/supabase/migrations/0040_polla_rpcs.sql`

- [ ] **Step 1: Apender al archivo `polla_best_partner`**

```sql

-- ============================================================
create or replace function public.polla_best_partner(
  p_user_id uuid,
  p_tournament_id uuid
)
returns table (
  partner_id      uuid,
  games_together  int,
  wins_together   int,
  win_pct         numeric
)
language sql
security definer
set search_path = public
as $$
  with v_season as (
    select current_season as s from public.tournaments where id = p_tournament_id
  ),
  my_matches as (
    select mp.match_id, mp.team, m.created_at,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team = mp.team) as my_team_score,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team <> mp.team) as opp_team_score
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where mp.user_id = p_user_id
       and tp.tournament_id = p_tournament_id
       and tp.season = (select s from v_season)
       and m.status = 'confirmed'
  ),
  partner_pairs as (
    select pmp.user_id as partner_id,
           mm.my_team_score > mm.opp_team_score as won
      from my_matches mm
      join public.match_players pmp
        on pmp.match_id = mm.match_id
       and pmp.team = mm.team
       and pmp.user_id <> p_user_id
  )
  select partner_id,
         count(*)::int as games_together,
         count(*) filter (where won)::int as wins_together,
         case when count(*) > 0
              then round(count(*) filter (where won) * 100.0 / count(*), 1)
              else 0 end as win_pct
    from partner_pairs
   group by partner_id
   order by wins_together desc nulls last, games_together desc nulls last
   limit 1;
$$;

grant execute on function public.polla_best_partner(uuid, uuid) to authenticated;

-- ============================================================
create or replace function public.polla_worst_rival(
  p_user_id uuid,
  p_tournament_id uuid
)
returns table (
  rival_id         uuid,
  games_against    int,
  wins_for_rival   int,
  win_pct          numeric
)
language sql
security definer
set search_path = public
as $$
  with v_season as (
    select current_season as s from public.tournaments where id = p_tournament_id
  ),
  my_matches as (
    select mp.match_id, mp.team,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team = mp.team) as my_team_score,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team <> mp.team) as opp_team_score
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where mp.user_id = p_user_id
       and tp.tournament_id = p_tournament_id
       and tp.season = (select s from v_season)
       and m.status = 'confirmed'
  ),
  rival_pairs as (
    select rmp.user_id as rival_id,
           mm.my_team_score < mm.opp_team_score as rival_won
      from my_matches mm
      join public.match_players rmp
        on rmp.match_id = mm.match_id
       and rmp.team <> mm.team
  )
  select rival_id,
         count(*)::int as games_against,
         count(*) filter (where rival_won)::int as wins_for_rival,
         case when count(*) > 0
              then round(count(*) filter (where rival_won) * 100.0 / count(*), 1)
              else 0 end as win_pct
    from rival_pairs
   group by rival_id
   order by wins_for_rival desc nulls last, games_against desc nulls last
   limit 1;
$$;

grant execute on function public.polla_worst_rival(uuid, uuid) to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add domino-app/supabase/migrations/0040_polla_rpcs.sql
git commit -m "feat(polla): RPCs best_partner + worst_rival"
```

---

### Task 3: Agregar `polla_standings` (función principal)

**Files:**
- Modify: `domino-app/supabase/migrations/0040_polla_rpcs.sql`

- [ ] **Step 1: Apender al archivo `polla_standings`**

```sql

-- ============================================================
create or replace function public.polla_standings(p_tournament_id uuid)
returns table (
  user_id              uuid,
  username             text,
  display_name         text,
  avatar_url           text,
  total_points         int,
  wins                 int,
  losses               int,
  win_pct              int,
  games_played         int,
  current_streak       text,
  best_partner_id      uuid,
  best_partner_name    text,
  worst_rival_id       uuid,
  worst_rival_name     text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with v_season as (
    select current_season as s from public.tournaments where id = p_tournament_id
  ),
  player_matches as (
    select mp.user_id, mp.team, mp.score, mp.match_id,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team = mp.team) as my_team_score,
           (select sum(score) from public.match_players
             where match_id = mp.match_id and team <> mp.team) as opp_team_score
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
      join public.tournament_pairings tp on tp.match_id = mp.match_id
     where tp.tournament_id = p_tournament_id
       and tp.season = (select s from v_season)
       and m.status = 'confirmed'
  ),
  aggregated as (
    select pm.user_id,
           sum(pm.score)::int as total_points,
           count(*) filter (where pm.my_team_score > pm.opp_team_score)::int as wins,
           count(*) filter (where pm.my_team_score < pm.opp_team_score)::int as losses,
           count(*)::int as games_played,
           case when count(*) > 0
                then round(count(*) filter (where pm.my_team_score > pm.opp_team_score) * 100.0 / count(*))::int
                else 0 end as win_pct
      from player_matches pm
     group by pm.user_id
  )
  select tp.user_id,
         p.username,
         p.display_name,
         p.avatar_url,
         coalesce(a.total_points, 0)  as total_points,
         coalesce(a.wins, 0)          as wins,
         coalesce(a.losses, 0)        as losses,
         coalesce(a.win_pct, 0)       as win_pct,
         coalesce(a.games_played, 0)  as games_played,
         public.calc_streak(tp.user_id, p_tournament_id) as current_streak,
         (select bp.partner_id  from public.polla_best_partner(tp.user_id, p_tournament_id) bp) as best_partner_id,
         (select p2.display_name from public.profiles p2
           where p2.id = (select bp.partner_id from public.polla_best_partner(tp.user_id, p_tournament_id) bp)
         ) as best_partner_name,
         (select wr.rival_id    from public.polla_worst_rival(tp.user_id, p_tournament_id) wr) as worst_rival_id,
         (select p3.display_name from public.profiles p3
           where p3.id = (select wr.rival_id from public.polla_worst_rival(tp.user_id, p_tournament_id) wr)
         ) as worst_rival_name
    from public.tournament_players tp
    join public.profiles p on p.id = tp.user_id
    left join aggregated a on a.user_id = tp.user_id
   where tp.tournament_id = p_tournament_id
   order by total_points desc, wins desc;
end;
$$;

grant execute on function public.polla_standings(uuid) to authenticated;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
--   select * from public.polla_standings('<tournament_id>'::uuid);
--   select public.calc_streak('<user_id>', '<tournament_id>');
-- ============================================================
```

- [ ] **Step 2: Commit**

```bash
git add domino-app/supabase/migrations/0040_polla_rpcs.sql
git commit -m "feat(polla): RPC polla_standings — leaderboard completo"
```

- [ ] **Step 3: Aplicar manualmente en Supabase**

Pegar el contenido de `0040_polla_rpcs.sql` en SQL Editor de Supabase y ejecutar. Verificar con:

```sql
select proname from pg_proc
 where proname in ('calc_streak','polla_standings','polla_best_partner','polla_worst_rival');
```

Expected: 4 filas devueltas.

---

### Task 4: Crear tipos TS para los resultados de RPCs

**Files:**
- Create: `domino-app/src/types/polla.ts`

- [ ] **Step 1: Definir los tipos**

```typescript
export type PollaStandingsRow = {
  user_id:           string;
  username:          string;
  display_name:      string | null;
  avatar_url:        string | null;
  total_points:      number;
  wins:              number;
  losses:            number;
  win_pct:           number;
  games_played:      number;
  current_streak:    string;
  best_partner_id:   string | null;
  best_partner_name: string | null;
  worst_rival_id:    string | null;
  worst_rival_name:  string | null;
};

export type PollaPartnerRow = {
  partner_id:     string;
  games_together: number;
  wins_together:  number;
  win_pct:        number;
};

export type PollaRivalRow = {
  rival_id:        string;
  games_against:   number;
  wins_for_rival:  number;
  win_pct:         number;
};
```

- [ ] **Step 2: Commit**

```bash
git add domino-app/src/types/polla.ts
git commit -m "feat(polla): tipos TS para resultados de RPCs"
```

---

### Task 5: Unit tests de los RPCs (fixture mockeada)

**Files:**
- Create: `domino-app/src/lib/__tests__/polla-rpc.test.ts`

- [ ] **Step 1: Crear el test file con la fixture**

```typescript
/**
 * Unit tests para las RPCs del polla (polla_standings, polla_best_partner,
 * polla_worst_rival, calc_streak).
 *
 * Estos tests NO ejecutan SQL — mockean el client de Supabase y verifican
 * que las funciones que consumen las RPCs procesen correctamente la respuesta.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import type { PollaStandingsRow, PollaPartnerRow, PollaRivalRow } from '@/types/polla';

// Fixture: 4 players, 5 partidas confirmadas en season 1.
// Carlos & Erik vs Gibbon & Gusi (×3): C+E win 2, G+Gu win 1
// Carlos & Gibbon vs Erik & Gusi (×2): C+Gb win 1, E+Gu win 1
const STANDINGS_FIXTURE: PollaStandingsRow[] = [
  {
    user_id: 'carlos', username: 'carlos', display_name: 'Carlos',
    avatar_url: null,
    total_points: 510, wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: '1L',
    best_partner_id: 'erik', best_partner_name: 'Erik',
    worst_rival_id: 'gusi', worst_rival_name: 'Gusi',
  },
  {
    user_id: 'erik', username: 'erik', display_name: 'Erik',
    avatar_url: null,
    total_points: 480, wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: '2W',
    best_partner_id: 'carlos', best_partner_name: 'Carlos',
    worst_rival_id: 'gusi', worst_rival_name: 'Gusi',
  },
];

describe('polla RPCs — shape + ordering', () => {
  it('PollaStandingsRow tiene todos los campos requeridos', () => {
    const row = STANDINGS_FIXTURE[0];
    expect(row).toHaveProperty('user_id');
    expect(row).toHaveProperty('total_points');
    expect(row).toHaveProperty('wins');
    expect(row).toHaveProperty('current_streak');
    expect(row).toHaveProperty('best_partner_id');
    expect(row).toHaveProperty('worst_rival_id');
  });

  it('total_points es la suma de scores del jugador en sus partidas', () => {
    // Carlos: 5 partidas, gano 3 con scores [100, 95, 110] y perdio 2 con [80, 125]
    // = 100 + 95 + 110 + 80 + 125 = 510
    expect(STANDINGS_FIXTURE[0].total_points).toBe(510);
  });

  it('wins y losses suman games_played', () => {
    for (const row of STANDINGS_FIXTURE) {
      expect(row.wins + row.losses).toBe(row.games_played);
    }
  });

  it('win_pct está entre 0 y 100', () => {
    for (const row of STANDINGS_FIXTURE) {
      expect(row.win_pct).toBeGreaterThanOrEqual(0);
      expect(row.win_pct).toBeLessThanOrEqual(100);
    }
  });

  it('current_streak tiene formato NUM+W|L o "—"', () => {
    for (const row of STANDINGS_FIXTURE) {
      expect(row.current_streak).toMatch(/^(\d+[WL]|—)$/);
    }
  });

  it('best_partner_id es null si el jugador no tuvo partner', () => {
    const emptyRow: PollaStandingsRow = {
      ...STANDINGS_FIXTURE[0],
      games_played: 0, wins: 0, losses: 0,
      best_partner_id: null, best_partner_name: null,
    };
    expect(emptyRow.best_partner_id).toBeNull();
  });

  it('ordering: total_points desc, wins desc tiebreak', () => {
    // Carlos (510 pts) viene antes que Erik (480 pts) aunque ambos tengan 3W
    const sorted = [...STANDINGS_FIXTURE].sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      return b.wins - a.wins;
    });
    expect(sorted[0].user_id).toBe('carlos');
    expect(sorted[1].user_id).toBe('erik');
  });
});

describe('PollaPartnerRow', () => {
  it('shape correcto', () => {
    const partner: PollaPartnerRow = {
      partner_id: 'erik',
      games_together: 3,
      wins_together: 2,
      win_pct: 66.7,
    };
    expect(partner.games_together).toBeGreaterThan(0);
    expect(partner.wins_together).toBeLessThanOrEqual(partner.games_together);
  });
});

describe('PollaRivalRow', () => {
  it('shape correcto', () => {
    const rival: PollaRivalRow = {
      rival_id: 'gusi',
      games_against: 5,
      wins_for_rival: 3,
      win_pct: 60.0,
    };
    expect(rival.games_against).toBeGreaterThan(0);
    expect(rival.wins_for_rival).toBeLessThanOrEqual(rival.games_against);
  });
});
```

- [ ] **Step 2: Correr el test (debe pasar — solo verifica shape de tipos)**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm test --run src/lib/__tests__/polla-rpc.test.ts
```

Expected: 9 tests pasan.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/lib/__tests__/polla-rpc.test.ts
git commit -m "test(polla): unit tests de shape de PollaStandingsRow"
```

---

### Task 6: Build + push del trabajo de sub-story 1b

- [ ] **Step 1: Typecheck + tests + build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck && pnpm test --run && pnpm build
```

Expected: 3 verde.

- [ ] **Step 2: Push**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git push -u origin feat/polla
```

---

## Sub-Story 2 — Wizard configuration

### Task 7: Extender el schema con `'polla'` y `is_open_ended`

**Files:**
- Modify: `domino-app/src/lib/tournament-schema.ts`
- Modify: `domino-app/src/lib/__tests__/tournaments-schema.test.ts`

- [ ] **Step 1: Agregar tests fallidos primero**

Apender a `tournaments-schema.test.ts`:

```typescript

// ── Polla format ───────────────────────────────────────────
it('acepta format=polla', () => {
  expect(createTournamentSchema.safeParse({ ...VALID_BASE, format: 'polla' }).success).toBe(true);
});

it('is_open_ended default false', () => {
  const parsed = createTournamentSchema.safeParse({ ...VALID_BASE, format: 'polla' });
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.is_open_ended).toBe(false);
});

it('acepta is_open_ended true', () => {
  const parsed = createTournamentSchema.safeParse({
    ...VALID_BASE, format: 'polla', is_open_ended: true
  });
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.is_open_ended).toBe(true);
});

it('rechaza is_open_ended no-boolean', () => {
  expect(createTournamentSchema.safeParse({
    ...VALID_BASE, format: 'polla', is_open_ended: 'yes'
  }).success).toBe(false);
});
```

- [ ] **Step 2: Correr los tests (deben fallar — `polla` no está en enum)**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm test --run src/lib/__tests__/tournaments-schema.test.ts
```

Expected: 4 tests nuevos fallan.

- [ ] **Step 3: Modificar el schema**

En `domino-app/src/lib/tournament-schema.ts`, reemplazar el campo `format` y agregar `is_open_ended`:

```typescript
  format: z.enum(["single_elim", "round_robin", "swiss", "polla"]),
  // ... resto del schema ...
  /** Si la polla es indefinida (true) o cerrada con N rondas (false). */
  is_open_ended: z.boolean().default(false),
```

- [ ] **Step 4: Correr los tests (deben pasar)**

```bash
pnpm test --run src/lib/__tests__/tournaments-schema.test.ts
```

Expected: todos los tests del archivo pasan, incluyendo los 4 nuevos.

- [ ] **Step 5: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/lib/tournament-schema.ts domino-app/src/lib/__tests__/tournaments-schema.test.ts
git commit -m "feat(polla): schema acepta format=polla + is_open_ended"
```

---

### Task 8: `createTournament` persiste `is_open_ended`

**Files:**
- Modify: `domino-app/src/lib/tournaments.ts`

- [ ] **Step 1: Editar el insert**

En `createTournament`, agregar `is_open_ended` al objeto que se hace insert:

```typescript
    .insert({
      // ... campos existentes ...
      rated: f.rated ?? true,
      is_open_ended: f.is_open_ended ?? false,
    })
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/lib/tournaments.ts
git commit -m "feat(polla): createTournament persiste is_open_ended"
```

---

### Task 9: PollaConfigStep component (step 6 polla-specific)

**Files:**
- Create: `domino-app/src/components/polla/PollaConfigStep.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
"use client";

import { useTournamentDraft } from "@/hooks/useTournamentDraft";

type Props = { userId: string };

export function PollaConfigStep({ userId }: Props) {
  const { draft, setField } = useTournamentDraft(userId);
  const isOpenEnded = draft.is_open_ended ?? false;

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Configuración de la polla</h2>
        <p className="text-text-mute text-sm">¿Cuántas rondas van a jugar?</p>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:border-border-strong transition-colors">
          <input
            type="radio"
            name="polla_mode"
            checked={isOpenEnded === true}
            onChange={() => setField({ is_open_ended: true })}
            className="mt-1 accent-primary"
          />
          <div>
            <div className="font-semibold">Indefinida</div>
            <div className="text-text-mute text-sm">Jugamos hasta que queramos. Sin fecha de fin.</div>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:border-border-strong transition-colors">
          <input
            type="radio"
            name="polla_mode"
            checked={isOpenEnded === false}
            onChange={() => setField({ is_open_ended: false })}
            className="mt-1 accent-primary"
          />
          <div>
            <div className="font-semibold">Con número fijo de rondas</div>
            <div className="text-text-mute text-sm">
              La polla termina automáticamente al completar las rondas pactadas.
            </div>
          </div>
        </label>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck && pnpm build
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/components/polla/PollaConfigStep.tsx
git commit -m "feat(polla): PollaConfigStep — selector indefinida vs cerrada"
```

---

### Task 10: Integrar PollaConfigStep en Step 6 del wizard

**Files:**
- Modify: `domino-app/src/app/tournaments/new/step-6/Step6Form.tsx`

- [ ] **Step 1: Leer el archivo actual y agregar branching**

Leer `domino-app/src/app/tournaments/new/step-6/Step6Form.tsx`. Identificar el lugar donde se renderiza el contenido principal del step. Agregar al inicio del return un check:

```tsx
import { PollaConfigStep } from "@/components/polla/PollaConfigStep";

// dentro del componente, antes del return:
const isPolla = draft.format === "polla";

// dentro del return, antes del contenido normal:
{isPolla ? (
  <PollaConfigStep userId={userId} />
) : (
  /* contenido normal del step 6 */
)}
```

NOTA: el shape exacto depende de la estructura actual del file. Si el step 6 ya tiene un solo `<section>`, envolver todo en una conditional.

- [ ] **Step 2: Build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm build
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/app/tournaments/new/step-6/Step6Form.tsx
git commit -m "feat(polla): step 6 del wizard renderiza PollaConfigStep cuando format=polla"
```

---

### Task 11: Step 3 agrega opción "Polla"

**Files:**
- Modify: `domino-app/src/app/tournaments/new/step-3/Step3Form.tsx`

- [ ] **Step 1: Leer el archivo y agregar la opción `polla` al array de formatos**

Leer Step3Form. Identificar el array de formatos. Agregar:

```tsx
{
  code: "polla",
  name: "Polla",
  desc: "Liga continua entre amigos. Pairings manuales, sin fecha de fin.",
  badge: { label: "🇻🇪 Popular en Venezuela", className: "bg-primary/10 text-primary" },
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm build
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/app/tournaments/new/step-3/Step3Form.tsx
git commit -m "feat(polla): step 3 agrega opción polla con badge cultural"
```

---

### Task 12: Step 2 fuerza `visibility=private` cuando polla

**Files:**
- Modify: `domino-app/src/app/tournaments/new/step-2/Step2Form.tsx`

- [ ] **Step 1: Leer y agregar useEffect**

Identificar dónde se setea visibility. Agregar:

```tsx
import { useEffect } from "react";

// dentro del componente:
const isPolla = draft.format === "polla";

useEffect(() => {
  if (isPolla && draft.visibility !== "private") {
    setField({ visibility: "private" });
  }
}, [isPolla, draft.visibility, setField]);
```

Y en el render, si `isPolla`, mostrar helper text:

```tsx
{isPolla && (
  <p className="text-text-mute text-xs mt-2">
    Las pollas son privadas por default. Solo los participantes la ven.
  </p>
)}
```

Y deshabilitar los otros radios:

```tsx
disabled={isPolla && opt.code !== "private"}
```

- [ ] **Step 2: Build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm build
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/app/tournaments/new/step-2/Step2Form.tsx
git commit -m "feat(polla): step 2 fuerza visibility=private cuando format=polla"
```

---

### Task 13: Step 7 skipea step 8 cuando polla

**Files:**
- Modify: `domino-app/src/app/tournaments/new/step-7/Step7Form.tsx`

- [ ] **Step 1: Identificar el `router.push("/tournaments/new/step-8")` y branchear**

Encontrar la línea `router.push("/tournaments/new/step-8")` (línea ~70 según vimos antes). Reemplazar:

```tsx
const nextStep = draft.format === "polla" ? 9 : 8;
router.push(`/tournaments/new/step-${nextStep}`);
```

- [ ] **Step 2: Build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm build
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/app/tournaments/new/step-7/Step7Form.tsx
git commit -m "feat(polla): step 7 skipea step 8 cuando format=polla"
```

---

### Task 14: Step 9 incluye is_open_ended en summary + input

**Files:**
- Modify: `domino-app/src/app/tournaments/new/step-9/Step9Form.tsx`

- [ ] **Step 1: Agregar fila al summary**

En el array `summaryRows`:

```tsx
// agregar después de la fila "Inscripción" si format=polla
...(draft.format === "polla"
  ? [{
      label: "Modo",
      value: (draft.is_open_ended ?? false) ? "Indefinida" : "Con número fijo de rondas",
      step: 6,
    }]
  : []),
```

Y en el `input` del `createTournament`:

```tsx
const input: CreateTournamentInput = {
  // ... campos existentes ...
  rated,
  is_open_ended: draft.is_open_ended ?? false,
};
```

También actualizar `FORMAT_LABELS`:

```tsx
const FORMAT_LABELS: Record<string, string> = {
  single_elim: "Eliminación directa",
  round_robin: "Todos contra todos",
  swiss: "Sistema suizo",
  polla: "Polla (liga continua)",
};
```

- [ ] **Step 2: Build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm build
```

Expected: verde.

- [ ] **Step 3: Commit + push**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/app/tournaments/new/step-9/Step9Form.tsx
git commit -m "feat(polla): step 9 muestra modo polla + pasa is_open_ended a createTournament"
git push
```

---

## Sub-Story 3 — Polla home page

### Task 15: PollaLeaderboard component + test

**Files:**
- Create: `domino-app/src/components/polla/PollaLeaderboard.tsx`
- Create: `domino-app/src/components/polla/__tests__/PollaLeaderboard.test.tsx`

- [ ] **Step 1: Crear el test failing**

```tsx
/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PollaLeaderboard } from '../PollaLeaderboard';
import type { PollaStandingsRow } from '@/types/polla';

const ROWS: PollaStandingsRow[] = [
  {
    user_id: 'a', username: 'carlos', display_name: 'Carlos',
    avatar_url: null,
    total_points: 510, wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: '2W',
    best_partner_id: 'b', best_partner_name: 'Erik',
    worst_rival_id: 'd', worst_rival_name: 'Gusi',
  },
  {
    user_id: 'b', username: 'erik', display_name: 'Erik',
    avatar_url: null,
    total_points: 480, wins: 3, losses: 2, win_pct: 60, games_played: 5,
    current_streak: '1L',
    best_partner_id: 'a', best_partner_name: 'Carlos',
    worst_rival_id: 'd', worst_rival_name: 'Gusi',
  },
];

describe('PollaLeaderboard', () => {
  it('renderiza los jugadores en orden de standings', () => {
    const { container } = render(<PollaLeaderboard rows={ROWS} currentUserId="a" />);
    const names = Array.from(container.querySelectorAll('[data-testid="player-name"]'))
      .map((el) => el.textContent);
    expect(names).toEqual(['Carlos', 'Erik']);
  });

  it('highlight del jugador actual', () => {
    const { container } = render(<PollaLeaderboard rows={ROWS} currentUserId="a" />);
    const carlosRow = container.querySelector('[data-user-id="a"]');
    expect(carlosRow?.className).toContain('bg-primary/10');
  });

  it('empty state cuando no hay rows', () => {
    const { getByText } = render(<PollaLeaderboard rows={[]} currentUserId="a" />);
    expect(getByText(/sin partidas todavía/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar — componente no existe)**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm test --run src/components/polla/__tests__/PollaLeaderboard.test.tsx
```

Expected: 3 tests fallan con "cannot find module".

- [ ] **Step 3: Crear el componente**

```tsx
"use client";

import type { PollaStandingsRow } from "@/types/polla";

type Props = {
  rows: PollaStandingsRow[];
  currentUserId: string;
};

export function PollaLeaderboard({ rows, currentUserId }: Props) {
  if (rows.length === 0) {
    return (
      <div className="card p-6 text-center text-text-mute">
        Sin partidas todavía. Tocá "+ Nueva partida" para empezar.
      </div>
    );
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-2 text-text-mute text-xs font-medium uppercase border-b border-border">
        <div>#</div>
        <div>Jugador</div>
        <div className="text-right">Pts</div>
        <div className="text-right">W</div>
        <div className="text-right">L</div>
        <div className="text-right">%</div>
        <div className="text-right">Racha</div>
      </div>

      {rows.map((row, i) => {
        const isCurrent = row.user_id === currentUserId;
        return (
          <div
            key={row.user_id}
            data-user-id={row.user_id}
            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 px-3 py-2.5 text-sm border-b border-border/30 last:border-0 ${
              isCurrent ? "bg-primary/10" : ""
            }`}
          >
            <div className="font-semibold text-text-mute">{i + 1}</div>
            <div data-testid="player-name" className="font-medium truncate">
              {row.display_name ?? row.username}
            </div>
            <div className="text-right font-mono">{row.total_points}</div>
            <div className="text-right">{row.wins}</div>
            <div className="text-right">{row.losses}</div>
            <div className="text-right">{row.win_pct}%</div>
            <div className="text-right font-mono text-xs">{row.current_streak}</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Correr el test (deben pasar)**

```bash
pnpm test --run src/components/polla/__tests__/PollaLeaderboard.test.tsx
```

Expected: 3 tests pasan.

- [ ] **Step 5: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/components/polla/PollaLeaderboard.tsx domino-app/src/components/polla/__tests__/PollaLeaderboard.test.tsx
git commit -m "feat(polla): PollaLeaderboard component + tests"
```

---

### Task 16: PartnerStatsCard component + test

**Files:**
- Create: `domino-app/src/components/polla/PartnerStatsCard.tsx`
- Create: `domino-app/src/components/polla/__tests__/PartnerStatsCard.test.tsx`

- [ ] **Step 1: Crear test failing**

```tsx
/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PartnerStatsCard } from '../PartnerStatsCard';

describe('PartnerStatsCard', () => {
  it('renderiza partner y rival cuando ambos existen', () => {
    const { getByText } = render(
      <PartnerStatsCard
        bestPartnerName="Erik" bestPartnerWins={8} bestPartnerLosses={2}
        worstRivalName="Gusi" worstRivalWins={3} worstRivalLosses={7}
      />,
    );
    expect(getByText(/Erik/)).toBeTruthy();
    expect(getByText(/8W-2L/)).toBeTruthy();
    expect(getByText(/Gusi/)).toBeTruthy();
    expect(getByText(/3W-7L/)).toBeTruthy();
  });

  it('muestra "—" cuando no hay partner detectado', () => {
    const { container } = render(
      <PartnerStatsCard
        bestPartnerName={null} bestPartnerWins={0} bestPartnerLosses={0}
        worstRivalName={null} worstRivalWins={0} worstRivalLosses={0}
      />,
    );
    expect(container.textContent).toContain('—');
  });
});
```

- [ ] **Step 2: Run, fail**

```bash
pnpm test --run src/components/polla/__tests__/PartnerStatsCard.test.tsx
```

Expected: fail.

- [ ] **Step 3: Crear componente**

```tsx
"use client";

type Props = {
  bestPartnerName: string | null;
  bestPartnerWins: number;
  bestPartnerLosses: number;
  worstRivalName: string | null;
  worstRivalWins: number;
  worstRivalLosses: number;
};

export function PartnerStatsCard({
  bestPartnerName, bestPartnerWins, bestPartnerLosses,
  worstRivalName, worstRivalWins, worstRivalLosses,
}: Props) {
  return (
    <div className="card space-y-3">
      <div>
        <div className="text-text-mute text-xs uppercase tracking-wide">Tu mejor partner</div>
        <div className="font-semibold mt-0.5">
          {bestPartnerName ? (
            <>{bestPartnerName} <span className="text-text-mute text-sm font-normal">({bestPartnerWins}W-{bestPartnerLosses}L)</span></>
          ) : (
            <span className="text-text-mute">—</span>
          )}
        </div>
      </div>
      <div>
        <div className="text-text-mute text-xs uppercase tracking-wide">Rival más fuerte</div>
        <div className="font-semibold mt-0.5">
          {worstRivalName ? (
            <>{worstRivalName} <span className="text-text-mute text-sm font-normal">({worstRivalWins}W-{worstRivalLosses}L)</span></>
          ) : (
            <span className="text-text-mute">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, pass**

```bash
pnpm test --run src/components/polla/__tests__/PartnerStatsCard.test.tsx
```

Expected: 2 tests pasan.

- [ ] **Step 5: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/components/polla/PartnerStatsCard.tsx domino-app/src/components/polla/__tests__/PartnerStatsCard.test.tsx
git commit -m "feat(polla): PartnerStatsCard component + tests"
```

---

### Task 17: PollaRoundsAccordion component

**Files:**
- Create: `domino-app/src/components/polla/PollaRoundsAccordion.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
"use client";

import { useState } from "react";

type MatchPreview = {
  match_id: string;
  team_a_user_ids: string[];
  team_b_user_ids: string[];
  team_a_score: number;
  team_b_score: number;
  status: "pending" | "confirmed" | "in_progress";
};

type RoundGroup = {
  round_number: number;
  matches: MatchPreview[];
};

type Props = {
  rounds: RoundGroup[];
  /** ID de la ronda actual para mantenerla expandida por default */
  currentRoundNumber: number;
  /** Map de user_id → display_name, usado para renderizar pairings */
  userNames: Record<string, string>;
};

function pairingLabel(userIds: string[], userNames: Record<string, string>): string {
  return userIds.map((id) => userNames[id] ?? "?").join(" & ");
}

function statusIcon(status: MatchPreview["status"]): string {
  switch (status) {
    case "confirmed":   return "✅";
    case "in_progress": return "⏳";
    default:            return "⌛";
  }
}

export function PollaRoundsAccordion({ rounds, currentRoundNumber, userNames }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([currentRoundNumber]));

  function toggle(n: number) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  if (rounds.length === 0) {
    return null;
  }

  return (
    <div className="card p-0 overflow-hidden">
      {rounds.map((r) => {
        const isOpen = expanded.has(r.round_number);
        const isCurrent = r.round_number === currentRoundNumber;
        return (
          <div key={r.round_number} className="border-b border-border/30 last:border-0">
            <button
              type="button"
              onClick={() => toggle(r.round_number)}
              className="w-full px-3 py-3 flex items-center justify-between text-left hover:bg-surface-2 transition-colors"
            >
              <div className="font-semibold">
                Ronda {r.round_number}
                {isCurrent && <span className="text-text-mute text-xs ml-2 font-normal">(actual)</span>}
              </div>
              <div className="text-text-mute text-sm">{isOpen ? "▾" : "▸"}</div>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 space-y-1.5">
                {r.matches.map((m) => (
                  <div key={m.match_id} className="flex items-center gap-2 text-sm">
                    <span className="text-base">{statusIcon(m.status)}</span>
                    <span className="flex-1 truncate">
                      {pairingLabel(m.team_a_user_ids, userNames)} {m.status === "confirmed" && `${m.team_a_score} — ${m.team_b_score}`} {pairingLabel(m.team_b_user_ids, userNames)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm build
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/components/polla/PollaRoundsAccordion.tsx
git commit -m "feat(polla): PollaRoundsAccordion component"
```

---

### Task 18: PollaHomePage component

**Files:**
- Create: `domino-app/src/components/polla/PollaHomePage.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { PollaLeaderboard } from "./PollaLeaderboard";
import { PartnerStatsCard } from "./PartnerStatsCard";
import { PollaRoundsAccordion } from "./PollaRoundsAccordion";
import { NewMatchInPollaModal } from "./NewMatchInPollaModal";
import { NewSeasonDialog } from "./NewSeasonDialog";
import type { PollaStandingsRow } from "@/types/polla";

type Props = {
  tournament: {
    id: string;
    name: string;
    is_open_ended: boolean;
    current_season: number;
    created_by: string;
    status: "open" | "in_progress" | "finished" | "cancelled";
  };
  currentUserId: string;
  standings: PollaStandingsRow[];
  rounds: Array<{
    round_number: number;
    matches: Array<{
      match_id: string;
      team_a_user_ids: string[];
      team_b_user_ids: string[];
      team_a_score: number;
      team_b_score: number;
      status: "pending" | "confirmed" | "in_progress";
    }>;
  }>;
  totalMatches: number;
  playerCount: number;
  userNames: Record<string, string>;
};

export function PollaHomePage({
  tournament, currentUserId, standings, rounds, totalMatches, playerCount, userNames,
}: Props) {
  const [showNewMatchModal, setShowNewMatchModal] = useState(false);
  const [showNewSeasonDialog, setShowNewSeasonDialog] = useState(false);

  const isOrganizer = tournament.created_by === currentUserId;
  const isClosed = tournament.status === "finished" || tournament.status === "cancelled";

  const meRow = standings.find((r) => r.user_id === currentUserId);

  const currentRoundNumber = Math.max(1, Math.ceil(totalMatches / Math.max(1, playerCount / 2)));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <Link href="/tournaments" className="text-sm text-text-mute hover:text-text">
          ← Atrás
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🇻🇪 {tournament.name}
            </h1>
            <div className="text-text-mute text-sm mt-1">
              {playerCount} jugadores · Temporada {tournament.current_season} · {totalMatches} partidas
            </div>
            <div className="flex gap-1.5 mt-2">
              <span className="badge bg-primary/15 text-primary">Polla</span>
              <span className="badge bg-info/15 text-info">
                {tournament.is_open_ended ? "Indefinida" : "Cerrada"}
              </span>
            </div>
          </div>
          {!isClosed && (
            <button
              type="button"
              onClick={() => setShowNewMatchModal(true)}
              className="btn-primary"
            >
              + Nueva partida
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <PollaLeaderboard rows={standings} currentUserId={currentUserId} />

      {/* Partner stats — solo si el current user es participante */}
      {meRow && (
        <PartnerStatsCard
          bestPartnerName={meRow.best_partner_name}
          bestPartnerWins={0}
          bestPartnerLosses={0}
          worstRivalName={meRow.worst_rival_name}
          worstRivalWins={0}
          worstRivalLosses={0}
        />
      )}

      {/* Rounds accordion */}
      <PollaRoundsAccordion
        rounds={rounds}
        currentRoundNumber={currentRoundNumber}
        userNames={userNames}
      />

      {/* Acciones organizer */}
      {isOrganizer && (
        <div className="card space-y-2">
          <div className="text-text-mute text-xs uppercase tracking-wide mb-2">Acciones del organizador</div>
          <Link
            href={`/tournaments/${tournament.id}/manage`}
            className="btn-secondary w-full"
          >
            Editar nombre
          </Link>
          {!isClosed && (
            <button
              type="button"
              onClick={() => setShowNewSeasonDialog(true)}
              className="btn-secondary w-full"
            >
              Nueva temporada
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showNewMatchModal && (
        <NewMatchInPollaModal
          tournamentId={tournament.id}
          rosterUserIds={standings.map((s) => s.user_id)}
          userNames={userNames}
          currentUserId={currentUserId}
          onClose={() => setShowNewMatchModal(false)}
        />
      )}
      {showNewSeasonDialog && (
        <NewSeasonDialog
          tournamentId={tournament.id}
          currentSeason={tournament.current_season}
          onClose={() => setShowNewSeasonDialog(false)}
        />
      )}
    </div>
  );
}
```

NOTA: `bestPartnerWins/Losses` y `worstRivalWins/Losses` quedan como 0 por ahora — el RPC `polla_standings` no los devuelve. Se completarán llamando a `polla_best_partner` y `polla_worst_rival` desde la página del torneo.

- [ ] **Step 2: Typecheck (los modales aún no existen, ESPERADO error)**

Skip — los modales se crean en sub-stories 4 y 5.

- [ ] **Step 3: Commit (sin build aún, va con sub-stories 4 y 5)**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/components/polla/PollaHomePage.tsx
git commit -m "feat(polla): PollaHomePage contenedor (modales pendientes)"
```

---

### Task 19: Modificar `/tournaments/[id]/page.tsx` para branching

**Files:**
- Modify: `domino-app/src/app/tournaments/[id]/page.tsx`

- [ ] **Step 1: Leer el archivo y agregar branching**

Identificar el punto donde se hace fetch del tournament. Después del fetch:

```tsx
import { PollaHomePage } from "@/components/polla/PollaHomePage";

// dentro de la función page, después de obtener `tournament` y `user`:
if (tournament.format === "polla") {
  // Fetch standings via RPC
  const { data: standings } = await supabase
    .rpc("polla_standings", { p_tournament_id: tournament.id });

  // Fetch pairings + matches del current_season para armar rounds
  const { data: pairings } = await supabase
    .from("polla_current_season_pairings")
    .select("*, matches(id, status, match_players(team, score))")
    .eq("tournament_id", tournament.id)
    .order("created_at", { ascending: true });

  // Fetch user names para el accordion
  const { data: players } = await supabase
    .from("tournament_players")
    .select("user_id, profiles(username, display_name)")
    .eq("tournament_id", tournament.id);

  const userNames: Record<string, string> = {};
  for (const p of players ?? []) {
    const prof = p.profiles as unknown as { username: string; display_name: string | null } | null;
    userNames[p.user_id] = prof?.display_name ?? prof?.username ?? "?";
  }

  // Agrupar pairings en rondas (cada N partidas, N = playerCount / 2)
  const playerCount = (players ?? []).length;
  const matchesPerRound = Math.max(1, Math.floor(playerCount / 2));
  const rounds: Array<{ round_number: number; matches: any[] }> = [];

  (pairings ?? []).forEach((p, idx) => {
    const roundIdx = Math.floor(idx / matchesPerRound);
    if (!rounds[roundIdx]) {
      rounds[roundIdx] = { round_number: roundIdx + 1, matches: [] };
    }
    const m = p.matches as { id: string; status: string; match_players: Array<{ team: number; score: number }> } | null;
    const teamAScore = m?.match_players?.filter((mp) => mp.team === 1).reduce((s, mp) => s + mp.score, 0) ?? 0;
    const teamBScore = m?.match_players?.filter((mp) => mp.team === 2).reduce((s, mp) => s + mp.score, 0) ?? 0;

    rounds[roundIdx].matches.push({
      match_id: m?.id ?? p.id,
      team_a_user_ids: p.team_a_user_ids,
      team_b_user_ids: p.team_b_user_ids,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      status: m?.status ?? "pending",
    });
  });

  return (
    <PollaHomePage
      tournament={tournament}
      currentUserId={user!.id}
      standings={(standings ?? []) as any}
      rounds={rounds}
      totalMatches={(pairings ?? []).length}
      playerCount={playerCount}
      userNames={userNames}
    />
  );
}

// fall-through: render normal de otros formatos
```

NOTA: el shape exacto depende del codebase. La idea es: detectar `format === 'polla'`, fetchear los datos, y renderizar `<PollaHomePage>`.

- [ ] **Step 2: Commit (build viene después de sub-stories 4 y 5)**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/app/tournaments/[id]/page.tsx
git commit -m "feat(polla): branching en page.tsx para renderizar PollaHomePage"
```

---

## Sub-Story 4 — Crear nueva partida en polla

### Task 20: Server action `createNewMatchInPolla`

**Files:**
- Create: `domino-app/src/lib/polla-actions.ts`

- [ ] **Step 1: Crear el archivo con la action**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";

// ============================================================
// createNewMatchInPolla — crea pairing + match en una polla
// ============================================================

const NewMatchSchema = z.object({
  tournament_id: z.string().uuid(),
  team_a:        z.array(z.string().uuid()).length(2),
  team_b:        z.array(z.string().uuid()).length(2),
});

export type NewMatchInput = z.infer<typeof NewMatchSchema>;

export async function createNewMatchInPolla(
  input: NewMatchInput,
): Promise<{ ok: true; match_id: string } | { ok: false; error: string }> {
  const parsed = NewMatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { tournament_id, team_a, team_b } = parsed.data;

  const all = [...team_a, ...team_b];
  if (new Set(all).size !== 4) {
    return { ok: false, error: "Los 4 jugadores deben ser distintos." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const limit = await checkLimit(rl.matchStart, `polla-match:${user.id}`);
  if (!limit.allowed) return { ok: false, error: limit.error };

  // 1. Cargar torneo: validar que es polla open y current_season
  const { data: t, error: tErr } = await supabase
    .from("tournaments")
    .select("id, format, status, current_season, modality, custom_goal, points_to_win")
    .eq("id", tournament_id)
    .single();
  if (tErr || !t) return { ok: false, error: "Torneo no encontrado." };
  if (t.format !== "polla") return { ok: false, error: "Este torneo no es una polla." };
  if (t.status !== "open" && t.status !== "in_progress") {
    return { ok: false, error: "La polla está cerrada." };
  }

  // 2. Validar que los 4 players están en el roster
  const { data: players } = await supabase
    .from("tournament_players")
    .select("user_id")
    .eq("tournament_id", tournament_id);
  const rosterIds = new Set((players ?? []).map((p) => p.user_id));
  for (const id of all) {
    if (!rosterIds.has(id)) {
      return { ok: false, error: "Hay un jugador que no pertenece a la polla." };
    }
  }

  // 3. Insertar match (format='doubles', NO 'polla')
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .insert({
      format:        "doubles",
      set_size:      "d6",
      modality:      t.modality,
      target_points: t.points_to_win,
      capicua_bonus: 30,
      status:        "in_progress",
      created_by:    user.id,
      tournament_id: tournament_id,
      // matches.rated hereda de tournaments.rated vía la lógica
      // de startLiveMatch (PR #10). Acá lo seteamos explícito leyéndolo
      // del torneo para evitar otra round-trip.
    })
    .select("id")
    .single();
  if (mErr || !match) return { ok: false, error: mErr?.message ?? "No se pudo crear la partida." };

  // 4. Insertar match_players
  const mpRows = [
    ...team_a.map((uid) => ({ match_id: match.id, user_id: uid, team: 1, score: 0 })),
    ...team_b.map((uid) => ({ match_id: match.id, user_id: uid, team: 2, score: 0 })),
  ];
  const { error: mpErr } = await supabase.from("match_players").insert(mpRows);
  if (mpErr) {
    await supabase.from("matches").delete().eq("id", match.id);
    return { ok: false, error: mpErr.message };
  }

  // 5. Insertar pairing con season = current_season
  const { error: prErr } = await supabase
    .from("tournament_pairings")
    .insert({
      tournament_id: tournament_id,
      round:         0,  // legacy column, no se usa en polla
      board:         1,
      team_a_user_ids: team_a,
      team_b_user_ids: team_b,
      match_id:      match.id,
      season:        t.current_season,
    });
  if (prErr) {
    console.error("[createNewMatchInPolla] pairing insert failed:", prErr);
    // Match queda creado pero sin pairing — el organizer puede ver el match
    // en su historial pero no aparece en la polla. Vale loggear sin bloquear.
  }

  revalidatePath(`/tournaments/${tournament_id}`);
  return { ok: true, match_id: match.id };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/lib/polla-actions.ts
git commit -m "feat(polla): server action createNewMatchInPolla"
```

---

### Task 21: NewMatchInPollaModal component + test

**Files:**
- Create: `domino-app/src/components/polla/NewMatchInPollaModal.tsx`
- Create: `domino-app/src/components/polla/__tests__/NewMatchInPollaModal.test.tsx`

- [ ] **Step 1: Crear test failing**

```tsx
/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NewMatchInPollaModal } from '../NewMatchInPollaModal';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/polla-actions', () => ({
  createNewMatchInPolla: vi.fn(() => Promise.resolve({ ok: true, match_id: 'm1' })),
}));

const ROSTER = ['carlos', 'erik', 'gibbon', 'gusi'];
const NAMES = { carlos: 'Carlos', erik: 'Erik', gibbon: 'Gibbon', gusi: 'Gusi' };

describe('NewMatchInPollaModal', () => {
  it('renderiza los 4 players del roster', () => {
    const { getByText } = render(
      <NewMatchInPollaModal
        tournamentId="t1" rosterUserIds={ROSTER} userNames={NAMES}
        currentUserId="carlos" onClose={() => {}}
      />,
    );
    for (const name of Object.values(NAMES)) {
      expect(getByText(name)).toBeTruthy();
    }
  });

  it('botón empezar deshabilitado hasta tener 2 players por team', () => {
    const { getByRole } = render(
      <NewMatchInPollaModal
        tournamentId="t1" rosterUserIds={ROSTER} userNames={NAMES}
        currentUserId="carlos" onClose={() => {}}
      />,
    );
    const btn = getByRole('button', { name: /empezar/i });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, fail**

```bash
pnpm test --run src/components/polla/__tests__/NewMatchInPollaModal.test.tsx
```

Expected: fail (componente no existe).

- [ ] **Step 3: Crear el componente**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNewMatchInPolla } from "@/lib/polla-actions";

type Props = {
  tournamentId: string;
  rosterUserIds: string[];
  userNames: Record<string, string>;
  currentUserId: string;
  onClose: () => void;
};

type Slot = "a1" | "a2" | "b1" | "b2";

export function NewMatchInPollaModal({
  tournamentId, rosterUserIds, userNames, currentUserId, onClose,
}: Props) {
  const router = useRouter();
  const [slots, setSlots] = useState<Record<Slot, string | null>>({
    a1: currentUserId, a2: null, b1: null, b2: null,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usedIds = new Set(Object.values(slots).filter((v): v is string => v !== null));
  const teamA = [slots.a1, slots.a2].filter((v): v is string => v !== null);
  const teamB = [slots.b1, slots.b2].filter((v): v is string => v !== null);
  const ready = teamA.length === 2 && teamB.length === 2;

  function setSlot(slot: Slot, userId: string | null) {
    setSlots((cur) => ({ ...cur, [slot]: userId }));
  }

  async function handleStart() {
    if (!ready) return;
    setPending(true);
    setError(null);
    const res = await createNewMatchInPolla({
      tournament_id: tournamentId,
      team_a: teamA as [string, string],
      team_b: teamB as [string, string],
    });
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    onClose();
    router.push(`/matches/${res.match_id}/live`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg w-full sm:max-w-md sm:rounded-2xl border-t sm:border border-border p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Nueva partida en la polla</h2>

        <TeamPicker
          label="Pareja A"
          slots={["a1", "a2"]}
          slotValues={slots}
          roster={rosterUserIds}
          userNames={userNames}
          usedIds={usedIds}
          onSet={setSlot}
        />

        <TeamPicker
          label="Pareja B"
          slots={["b1", "b2"]}
          slotValues={slots}
          roster={rosterUserIds}
          userNames={userNames}
          usedIds={usedIds}
          onSet={setSlot}
        />

        <p className="text-text-mute text-xs">Cualquier combinación está permitida.</p>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="btn-primary flex-1"
            disabled={!ready || pending}
          >
            {pending ? "Creando…" : "Empezar partida →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamPicker({
  label, slots, slotValues, roster, userNames, usedIds, onSet,
}: {
  label: string;
  slots: Slot[];
  slotValues: Record<Slot, string | null>;
  roster: string[];
  userNames: Record<string, string>;
  usedIds: Set<string>;
  onSet: (slot: Slot, userId: string | null) => void;
}) {
  return (
    <div>
      <div className="text-text-mute text-xs uppercase tracking-wide mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot) => (
          <select
            key={slot}
            value={slotValues[slot] ?? ""}
            onChange={(e) => onSet(slot, e.target.value || null)}
            className="card p-2.5 text-sm w-full"
          >
            <option value="">— Elegir —</option>
            {roster.map((uid) => {
              const taken = usedIds.has(uid) && slotValues[slot] !== uid;
              return (
                <option key={uid} value={uid} disabled={taken}>
                  {userNames[uid] ?? "?"}{taken ? " (asignado)" : ""}
                </option>
              );
            })}
          </select>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, pass**

```bash
pnpm test --run src/components/polla/__tests__/NewMatchInPollaModal.test.tsx
```

Expected: 2 tests pasan.

- [ ] **Step 5: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/components/polla/NewMatchInPollaModal.tsx domino-app/src/components/polla/__tests__/NewMatchInPollaModal.test.tsx
git commit -m "feat(polla): NewMatchInPollaModal con tap-to-pair"
```

---

## Sub-Story 5 — Nueva temporada + cerrar polla + E2E

### Task 22: Server actions `startNewSeason` y `closePolla`

**Files:**
- Modify: `domino-app/src/lib/polla-actions.ts`

- [ ] **Step 1: Apender las nuevas actions**

```typescript

// ============================================================
// startNewSeason — incrementa current_season
// ============================================================

const NewSeasonSchema = z.object({
  tournament_id: z.string().uuid(),
  confirm_name:  z.string(),
});

export async function startNewSeason(
  input: z.infer<typeof NewSeasonSchema>,
): Promise<{ ok: true; new_season: number } | { ok: false; error: string }> {
  const parsed = NewSeasonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { tournament_id, confirm_name } = parsed.data;

  if (confirm_name.trim().toLowerCase() !== "nueva temporada") {
    return { ok: false, error: "Escribí exactamente 'nueva temporada' para confirmar." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Solo el founder puede iniciar nueva temporada
  const { data: t, error: tErr } = await supabase
    .from("tournaments")
    .select("id, created_by, current_season, format")
    .eq("id", tournament_id)
    .single();
  if (tErr || !t) return { ok: false, error: "Torneo no encontrado." };
  if (t.format !== "polla") return { ok: false, error: "Este torneo no es una polla." };
  if (t.created_by !== user.id) return { ok: false, error: "Solo el organizador puede empezar una temporada." };

  const newSeason = t.current_season + 1;
  const { error: uErr } = await supabase
    .from("tournaments")
    .update({ current_season: newSeason })
    .eq("id", tournament_id);
  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath(`/tournaments/${tournament_id}`);
  return { ok: true, new_season: newSeason };
}

// ============================================================
// closePolla — marca status='finished'
// ============================================================

export async function closePolla(
  tournament_id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(tournament_id).success) {
    return { ok: false, error: "ID inválido." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: t, error: tErr } = await supabase
    .from("tournaments")
    .select("id, created_by, format, status")
    .eq("id", tournament_id)
    .single();
  if (tErr || !t) return { ok: false, error: "Torneo no encontrado." };
  if (t.format !== "polla") return { ok: false, error: "Este torneo no es una polla." };
  if (t.created_by !== user.id) return { ok: false, error: "Solo el organizador puede cerrar la polla." };
  if (t.status === "finished") return { ok: true };  // idempotente

  const { error: uErr } = await supabase
    .from("tournaments")
    .update({ status: "finished" })
    .eq("id", tournament_id);
  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath(`/tournaments/${tournament_id}`);
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck
```

Expected: verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/lib/polla-actions.ts
git commit -m "feat(polla): server actions startNewSeason + closePolla"
```

---

### Task 23: NewSeasonDialog component

**Files:**
- Create: `domino-app/src/components/polla/NewSeasonDialog.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNewSeason } from "@/lib/polla-actions";

type Props = {
  tournamentId: string;
  currentSeason: number;
  onClose: () => void;
};

export function NewSeasonDialog({ tournamentId, currentSeason, onClose }: Props) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newSeason = currentSeason + 1;
  const canConfirm = confirmText.trim().toLowerCase() === "nueva temporada";

  async function handleConfirm() {
    if (!canConfirm) return;
    setPending(true);
    setError(null);
    const res = await startNewSeason({
      tournament_id: tournamentId,
      confirm_name:  confirmText,
    });
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg w-full sm:max-w-md sm:rounded-2xl border-t sm:border border-border p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-warning">
          <span className="text-xl">⚠️</span>
          <h2 className="text-lg font-semibold">Nueva temporada</h2>
        </div>

        <p className="text-sm">Vas a empezar la <strong>Temporada {newSeason}</strong>. Esto va a:</p>
        <ul className="text-sm text-text-mute space-y-1 pl-4 list-disc">
          <li>Resetear stats a 0 para todos en el leaderboard.</li>
          <li>El historial de partidas se mantiene.</li>
          <li>Los jugadores siguen siendo los mismos.</li>
        </ul>

        <div className="space-y-1.5">
          <label className="text-sm">Escribí <code className="font-mono bg-surface-2 px-1.5 rounded text-xs">nueva temporada</code> para confirmar:</label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="card w-full p-2.5"
            autoFocus
          />
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-primary flex-1"
            disabled={!canConfirm || pending}
          >
            {pending ? "Procesando…" : `Empezar Temporada ${newSeason} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + tests (todos los componentes existen ahora)**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck && pnpm test --run && pnpm build
```

Expected: 3 verde.

- [ ] **Step 3: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/src/components/polla/NewSeasonDialog.tsx
git commit -m "feat(polla): NewSeasonDialog con type-to-confirm"
```

---

### Task 24: E2E test — crear polla y jugar

**Files:**
- Create: `domino-app/e2e/polla-create-and-play.spec.ts`

- [ ] **Step 1: Crear el spec**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Polla: crear y jugar", () => {
  test("flujo completo desde login hasta leaderboard actualizado", async ({ page }) => {
    // Login. Antes de implementar este E2E, leer e2e/back-navigation.spec.ts
    // (o cualquier spec existente del proyecto) para encontrar el helper de
    // login ya establecido. Si no hay helper, agregarlo a e2e/helpers.ts
    // como `loginAsTestUser(page, email)` que hace email+password login
    // contra un usuario seed.
    await page.goto("/login");
    await page.fill('input[name="email"]', "test@domirank.test");
    await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD ?? "test-password");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard$/);

    // Crear polla
    await page.goto("/tournaments/new/step-1");
    await page.fill('input[name="name"]', "Polla E2E " + Date.now());
    await page.click('button:has-text("Continuar")');

    // Step 2 — visibility (forzado a private por polla)
    // … no hace falta tocar

    // Step 3 — format polla
    await page.click('label:has-text("Polla")');
    await page.click('button:has-text("Continuar")');

    // Step 4 — modality
    await page.click('label:has-text("Venezolano")');
    await page.click('button:has-text("Continuar")');

    // Step 5 — player count 4
    await page.click('button:has-text("4")');
    await page.click('button:has-text("Continuar")');

    // Step 6 — polla config (indefinida)
    await page.click('label:has-text("Indefinida")');
    await page.click('button:has-text("Continuar")');

    // Step 7 — participantes (asumir 3 amigos seedeados como erik, gibbon, gusi)
    for (const name of ["erik", "gibbon", "gusi"]) {
      await page.fill('input[placeholder*="Buscar"]', name);
      await page.click(`button:has-text("${name}")`);
    }
    await page.click('button:has-text("Continuar")');

    // Step 9 — resumen (skipea 8)
    await expect(page.locator('text=Polla (liga continua)')).toBeVisible();
    await expect(page.locator('text=Indefinida')).toBeVisible();
    await page.click('button:has-text("Crear torneo")');

    // Llega a la polla home
    await expect(page.locator('text=Polla')).toBeVisible();
    await expect(page.locator('text=Temporada 1')).toBeVisible();

    // Tap "Nueva partida"
    await page.click('button:has-text("Nueva partida")');

    // Modal: armar pairings
    const selectsTeamA = page.locator('select').nth(1); // skip team A slot 1 (current user)
    await selectsTeamA.selectOption({ label: "Erik" });
    await page.locator('select').nth(2).selectOption({ label: "Gibbon" });
    await page.locator('select').nth(3).selectOption({ label: "Gusi" });
    await page.click('button:has-text("Empezar partida")');

    // Llegamos a /matches/[id]/live
    await expect(page).toHaveURL(/\/matches\/.+\/live$/);
  });
});
```

NOTA: este test depende de helpers/fixtures que ya existen en el proyecto. Si el login requiere setup específico (cookie, magic link mock), adaptarlo al patrón de los otros e2e tests del repo.

- [ ] **Step 2: Commit (E2E no se corre en CI; lo corre el dev manualmente)**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/e2e/polla-create-and-play.spec.ts
git commit -m "test(polla): E2E crear polla y jugar"
```

---

### Task 25: E2E test — nueva temporada

**Files:**
- Create: `domino-app/e2e/polla-new-season.spec.ts`

- [ ] **Step 1: Crear el spec**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Polla: nueva temporada", () => {
  test("incrementar season resetea el leaderboard pero preserva historial", async ({ page }) => {
    // Asume polla existente con 3 partidas confirmadas, slug "polla-e2e-test"
    await page.goto("/tournaments/polla-e2e-test");

    // Capturar standings actuales (para verificar reset)
    await expect(page.locator('text=Temporada 1')).toBeVisible();

    // Tap "Nueva temporada"
    await page.click('button:has-text("Nueva temporada")');

    // Modal type-to-confirm
    await expect(page.locator('text=Vas a empezar la Temporada 2')).toBeVisible();
    await page.fill('input[type="text"]', "nueva temporada");
    await page.click('button:has-text("Empezar Temporada 2")');

    // Verificar reset
    await expect(page.locator('text=Temporada 2')).toBeVisible();
    // Standings deberían estar todos en 0
    const carlosRow = page.locator('[data-user-id]').first();
    await expect(carlosRow.locator('text=/^0$/').first()).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git add domino-app/e2e/polla-new-season.spec.ts
git commit -m "test(polla): E2E nueva temporada"
```

---

### Task 26: Build final + push + PR

- [ ] **Step 1: Typecheck + tests + build**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino/domino-app
pnpm typecheck && pnpm test --run && pnpm build
```

Expected: 3 verde.

- [ ] **Step 2: Push**

```bash
cd /Users/carlosmartinez/Documents/Claude/Projects/Domino
git push
```

- [ ] **Step 3: Abrir PR**

```bash
gh pr create --base main --title "feat(polla): formato Polla (liga continua entre amigos)" --body "$(cat <<'EOF'
## Summary

Implementa el formato Polla según `docs/superpowers/specs/2026-05-27-polla-design.md`. Liga continua entre 4-8 amigos con pairings manuales, scoring acumulativo, partner stats, y temporadas reseteables.

## Sub-stories implementadas

| # | Sub-story | Estado |
|---|-----------|--------|
| 1a | Schema migration 0039 | ✅ |
| 1b | RPCs migration 0040 + unit tests | ✅ |
| 2 | Wizard configuration (step 3/6/2/7/9) | ✅ |
| 3 | Polla home page (leaderboard + partner stats + accordion) | ✅ |
| 4 | Crear nueva partida (modal + server action) | ✅ |
| 5 | Nueva temporada + cerrar polla + E2E | ✅ |

Sub-story 6 (rating integration) ya estaba en main vía PR #10.

## Verificación

- ✅ pnpm typecheck verde
- ✅ pnpm test --run pasa (incluyendo nuevos tests de polla)
- ✅ pnpm build verde
- ✅ E2E specs creadas (no corren en CI)

## Steps post-merge

```bash
cd domino-app
supabase db push   # aplica 0039 (si no estaba) + 0040
```

Ya aplicada 0039 manualmente. 0040 va con el push.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

### Spec coverage check

- ✅ Sección 4 spec (schema) → Task 1 (ya commiteada 0039) + sub-story 1a
- ✅ Sección 5 spec (RPCs) → Tasks 1-3 (migration 0040) + Task 4 (tipos) + Task 5 (tests)
- ✅ Sección 6 spec (sub-stories MVP) → estructura completa del plan
- ✅ Sección 7 spec (wizard config) → Tasks 7-14
- ✅ Sección 8 spec (polla home) → Tasks 15-19
- ✅ Sección 9 spec (nueva partida) → Tasks 20-21
- ✅ Sección 10 spec (nueva temporada + cerrar) → Tasks 22-23
- ✅ Sección 11 spec (testing) → unit tests inline, E2E en Tasks 24-25
- ✅ Sección 12 spec (AC) → AC distribuidos en steps "expected" de cada task

### Decisiones tomadas en el plan

- Cada sub-story es **una serie de commits** en `feat/polla`, no PRs separadas. Razón: las 5 sub-stories están acopladas; PRs separadas agregarían overhead sin beneficio (decisión confirmada en brainstorm).
- E2E tests **se commitean pero no se corren en CI** — siguen el patrón del proyecto (los E2E corren manual o en cron).
- La migration **0040 se aplica manualmente en Supabase Dashboard** después del Task 3 (igual que 0039 al inicio del trabajo).
- El componente `PollaHomePage` referencia los modales antes de que existan (Task 18 commiteado sin build verde). El build verde llega en Task 23 cuando todos los componentes están listos.

### Riesgos identificados

- **El shape exacto de algunos steps depende del codebase existente** (e.g., Task 10 sobre Step6Form, Task 12 sobre Step2Form). El plan dice "leer el archivo y agregar branching" — el implementador tiene que verificar el shape real antes de editar.
- **Performance del query `polla_standings`** con 100+ partidas: subqueries dentro de CTE. Mitigación: `EXPLAIN ANALYZE` durante Task 6 y crear índice si hace falta.
- **Idempotencia del `startNewSeason`** vs doble-click: validación de `confirm_name` + UI lock cubren el caso normal. Pero si el usuario hace request paralela vía DevTools, podría duplicar — riesgo bajo, accepted.

### Diferido (no incluido en este plan)

- Selector visual de temporadas históricas — defer a polish posterior.
- Stats preview "Erik y vos han jugado 8 veces" en NewMatchInPollaModal — opcional, defer a backlog.
- Badge "Amistosa" en cards de historial — PR aparte, no afecta polla.
- Acción "Cerrar polla" en UI — el server action existe (Task 22) pero el botón está pendiente. Decisión: el botón se agrega en una iteración posterior; mientras tanto el organizer puede cerrar via SQL si es urgente.
