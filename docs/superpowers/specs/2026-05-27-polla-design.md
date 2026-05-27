# Polla Format — Design Spec

**Fecha:** 2026-05-27
**Owner:** Carlos Martínez
**Estado:** Brainstorm aprobado, listo para writing-plans
**Branch de trabajo:** `feat/polla`
**Referencias:** `POLLA_FORMAT_PROMPT.md` (spec original), PR #10 (sub-story 6 ya mergeada)

---

## 1. Propósito

Agregar el formato **Polla** al sistema de torneos de DomiRank. Es un container persistente de partidas entre un roster fijo (4–8 amigos) con pairings 100% manuales, scoring acumulativo estilo Whist (suma de puntos del equipo), y temporadas reseteables que preservan historial. Es el formato más popular en Venezuela para grupos casuales.

**No es un torneo cerrado.** Es una liga continua entre los mismos amigos que pueden seguir jugando indefinidamente, o pueden cerrar después de N rondas.

---

## 2. Decisiones de producto (cerradas)

Las 14 decisiones del `POLLA_FORMAT_PROMPT.md` se preservan. Las que cambiaron por audit técnico:

| # | Decisión | Valor |
|---|----------|-------|
| 1 | Duración | Coexisten: **indefinida** o **cerrada con N rondas**. Organizer elige al crear. |
| 2 | Crear partidas | Cualquier participante puede crear. |
| 3 | Scoring | Suma de `match_players.score` del jugador en todas sus partidas + V/D visible. |
| 4 | Player count | 4–8 jugadores (par, fijo al crear). Validado en app, no en DB. |
| 5 | Rating Elo global impact | **Reusa `tournaments.rated`** (existing column, hecho honored en PR #10). NO se agrega `affects_rating`. |
| 6 | Pairings | Totalmente libres — players eligen cualquier combinación. |
| 7 | Partner stats | Mostrar "mejor partner" + "rival más fuerte" en leaderboard. |
| 8 | Visibilidad | Privada por default + invite-only. No aparece en discover. |
| 9 | Notif al crear partida | Sin notif (asumir IRL en la mesa). |
| 10 | Navegación | Dentro de `/tournaments` con badge visual "Polla". |
| 11 | Roster cambio post-creación | Fijo al crear, no se modifica. |
| 12 | Attestation (3-of-4) | Sí, igual que cualquier partida. |
| 13 | "Rondas" en modo indefinido | Agrupación visual cada N partidas (N = players/2). No impone constraint. |
| 14 | Reset del leaderboard | Botón "Nueva temporada" — incrementa `current_season`, leaderboard arranca en 0, historial preservado. |

---

## 3. Fixes técnicos del audit

El spec original tenía 4 issues. Resolución:

1. **RPCs usaban columnas inexistentes** (`m.score_team1`, `m.score_team2`, `m.winner_team`). Reescritas para derivar de `match_players.score` + `match_players.team`. Detalle en sección 5.
2. **`calc_streak()` no existía**. Se crea en sub-story 1b.
3. **`affects_rating` vs `rated`**. Resuelto: reusamos `tournaments.rated` (PR #10).
4. **`matches.format` vs `tournaments.format`**. Cuando se crea una match desde polla, `matches.format = 'doubles'`, NO `'polla'`. Documentado en sub-story 4.

---

## 4. Modelo de datos

### Migration `0039_polla_format.sql` (✅ commiteada en `feat/polla:558e655`)

```sql
-- 1. 'polla' en el enum de tournaments.format
alter table public.tournaments drop constraint if exists tournaments_format_check;
alter table public.tournaments add constraint tournaments_format_check
  check (format in (
    'rotation','round_robin','swiss','single_elim','double_elim','points_league',
    'polla'
  ));

-- 2. Campos nuevos
alter table public.tournaments
  add column if not exists is_open_ended boolean not null default false;
alter table public.tournaments
  add column if not exists current_season int not null default 1;

-- 3. Season en tournament_pairings
alter table public.tournament_pairings
  add column if not exists season int not null default 1;
create index if not exists idx_tournament_pairings_season
  on public.tournament_pairings(tournament_id, season);

-- 4. Vista helper
create or replace view public.polla_current_season_pairings as
  select tp.*
    from public.tournament_pairings tp
    join public.tournaments t on t.id = tp.tournament_id
   where tp.season = t.current_season;
```

### Lo que NO se agrega

- Tabla separada `pollas` — reusa `tournaments`.
- Columna `affects_rating` — reusa `tournaments.rated`.
- Constraint DB de player count — validación en app (sub-story 2).

---

## 5. RPCs (sub-story 1b)

Migration **`0040_polla_rpcs.sql`** crea 4 funciones, todas `security definer set search_path = public`, `grant execute to authenticated`.

### `calc_streak(p_user_id, p_tournament_id) returns text`

Calcula la racha actual del jugador en la temporada.

- Lee `match_players` del usuario en partidas confirmadas del torneo+temporada, ordenado por `matches.created_at DESC`.
- Determina W/L sumando scores por team: `won := (sum(score) filter team = mp.team) > (sum(score) filter team <> mp.team)`.
- Recorre desde la más reciente hasta encontrar cambio de resultado.
- Devuelve `"3W"`, `"1L"`, o `"—"` si no jugó.

> **Decisión final:** la función toma 2 args y resuelve `current_season` internamente desde `tournaments`. Si en el futuro hace falta calcular racha de una temporada histórica, se agrega una función separada `calc_streak_for_season(user_id, tournament_id, season)` para no romper el contrato actual.

### `polla_standings(p_tournament_id) returns table`

Leaderboard de la temporada actual. CTE base:

```sql
with my_matches as (
  select pcsp.match_id, mp.user_id, mp.team, mp.score,
         (select sum(score) from match_players
            where match_id = pcsp.match_id and team = mp.team) as my_team_score,
         (select sum(score) from match_players
            where match_id = pcsp.match_id and team <> mp.team) as opp_team_score
    from polla_current_season_pairings pcsp
    join match_players mp on mp.match_id = pcsp.match_id
    join matches m on m.id = pcsp.match_id
   where pcsp.tournament_id = p_tournament_id
     and m.status = 'confirmed'
)
```

Devuelve `user_id, username, display_name, avatar_url, total_points, wins, losses, win_pct, games_played, current_streak, best_partner_id, best_partner_name, worst_rival_id, worst_rival_name`.

Ordering: `total_points DESC, wins DESC`.

### `polla_best_partner(p_user_id, p_tournament_id) returns table`

Partner con más wins juntos en la temporada actual. Devuelve `partner_id, games_together, wins_together, win_pct`. Tie-break: `games_together DESC`.

### `polla_worst_rival(p_user_id, p_tournament_id) returns table`

Rival con más wins contra el caller en la temporada actual. Devuelve `rival_id, games_against, wins_for_rival, win_pct`. Tie-break: `games_against DESC`.

---

## 6. Sub-stories del MVP

Una sola PR `feat/polla → main` con commits granulares. Razón: las sub-stories están fuertemente acopladas; stacked PRs agregan overhead sin beneficio.

| # | Sub-story | Tiempo | Depende de |
|---|-----------|--------|------------|
| **1a** | ✅ Schema base (migration 0039) — commit `558e655` | hecho | — |
| **1b** | RPCs (migration 0040) + unit tests | ~1d | 1a |
| **2** | Wizard config (step 6 polla, schema, branching) | ~1d | 1a |
| **3** | Polla home page (header, leaderboard, partner stats, rounds accordion) | ~2–3d | 1b, 2 |
| **4** | Crear nueva partida (modal con dual-team selector + server action) | ~1–2d | 3 |
| **5** | Nueva temporada + cerrar polla + E2E tests | ~1d | 3 |

**Total restante:** ~6–8 días.

### Sub-story 6 — Rating integration toggle

**Ya hecha en PR #10** (mergeada). No requiere trabajo adicional. `tournaments.rated` se hereda automáticamente cuando se crea match desde un torneo vía `startLiveMatch`.

---

## 7. Sub-story 2 — Wizard configuration

### Cambios en `tournament-schema.ts`

```ts
format: z.enum([
  'single_elim', 'round_robin', 'swiss', 'polla',   // ← agregar 'polla'
]),
is_open_ended: z.boolean().default(false),
```

### Cambios por step del wizard

| Step | Cuando `format = 'polla'` |
|------|---------------------------|
| 2 (visibility) | Forzado a `private`. Helper text: "Las pollas son privadas por default. Solo los participantes la ven." |
| 3 (formato) | Opción "Polla" con badge `🇻🇪 Popular en Venezuela`. |
| 5 (player count) | Presets `[4, 6, 8]`. |
| 6 (config) | Selector "Indefinida / Con número fijo de rondas". Si fijo, slider 2–6 rondas. |
| 7 (participantes) | Search players normal, validación 4–8 incluyendo al creator. |
| 8 (tiempo/meta) | **Skip**: navegar directo de step 7 → step 9. Branching explícito en `router.push` del step 7. |
| 9 (resumen) | Muestra "Modo: Indefinida" o "Modo: 3 rondas". Toggle `rated` ya está (PR #10). |

### Cambios en `createTournament` (`src/lib/tournaments.ts`)

Pasar `is_open_ended: f.is_open_ended ?? false` al insert. `current_season=1` viene por default del schema.

---

## 8. Sub-story 3 — Polla home page

### Routing

`src/app/tournaments/[id]/page.tsx` branchea: si `tournament.format === 'polla'`, renderiza `<PollaHomePage>` en lugar del leaderboard genérico.

### Componentes nuevos

```
src/components/polla/
├── PollaHomePage.tsx           # contenedor principal
├── PollaLeaderboard.tsx        # tabla con polla_standings
├── PartnerStatsCard.tsx        # "Tu mejor partner / Rival más fuerte"
└── PollaRoundsAccordion.tsx    # agrupación visual cada N partidas
```

### Layout (mockup textual del spec original)

```
┌─ Header ────────────────────────────────────────────────┐
│  ← Atrás                                                │
│  🇻🇪 Polla del barrio              [+ Nueva partida]   │
│  4 jugadores · Temporada 1 · 25 partidas                │
│  [badge: Polla] [badge: Indefinida]                     │
└─────────────────────────────────────────────────────────┘

┌─ Leaderboard ───────────────────────────────────────────┐
│  #  JUGADOR     PTS    W   L   %    RACHA               │
│  1  Carlos      2543   16  9   64%  3W                  │
│  2  Erik        2487   14  11  56%  1L                  │
│  3  Gibbon      2401   13  12  52%  1W                  │
│  4  Gusi        2298   8   17  32%  2L                  │
│                                                         │
│  Tu mejor partner: Erik (8W-2L)                         │
│  Tu rival más fuerte: Gusi (3W-7L)                      │
└─────────────────────────────────────────────────────────┘

┌─ Rondas (agrupadas cada players/2) ─────────────────────┐
│  ▾ Ronda 8 (en progreso)                                │
│      Partida 24 ✅ Carlos&Erik 100 — 87 Gibbon&Gusi     │
│      Partida 25 ⏳ Pendiente                            │
│  ▸ Ronda 7                                              │
│  ▸ Ronda 6                                              │
└─────────────────────────────────────────────────────────┘

┌─ Acciones organizer (solo si created_by = auth.uid()) ──┐
│  [Editar nombre]                                        │
│  [Nueva temporada]                                      │
│  [Cerrar polla]                                         │
└─────────────────────────────────────────────────────────┘
```

### Mobile-first

Validado a 375px (iPhone SE). Leaderboard scrollable horizontal si las columnas no entran. Acordeón colapsado por default salvo la ronda actual.

---

## 9. Sub-story 4 — Crear nueva partida

### UI: `NewMatchInPollaModal`

Bottom sheet en mobile, modal en desktop. Dual-team selector con tap-to-pair:

```
┌─ Nueva partida en la polla ─────────────────────────────┐
│  Pareja A:                                              │
│    [Carlos (vos)] [Erik]                                │
│  Pareja B:                                              │
│    [Gibbon] [Gusi]                                      │
│                                                         │
│  (Opcional: "Erik y vos han jugado 8 veces. Récord:    │
│   5W-3L." — preview de pairings repetidas)              │
│                                                         │
│  [Cancelar]                  [Empezar partida →]        │
└─────────────────────────────────────────────────────────┘
```

### Server action: `createNewMatchInPolla(tournamentId, teamA, teamB)`

En `src/lib/polla-actions.ts` (nuevo):

1. Validación: caller es participante del torneo. teamA y teamB tienen 2 players cada uno, todos del roster, sin duplicados.
2. Rate limit: `rl.matchStart` con identifier `polla-match:${user.id}`.
3. Lee `tournament.current_season`.
4. Insert en `tournament_pairings` con `season = current_season`.
5. Insert en `matches` con `format='doubles'` (no `'polla'`), `tournament_id` set. `rated` se hereda automáticamente vía la lógica de `startLiveMatch` (PR #10).
6. Insert match_players (4 rows).
7. Devuelve `{ ok: true, match_id }` para que el client redirija a `/matches/[id]/live`.

### Stats preview (opcional, MVP)

Si queda tiempo en sub-story 4: query rápida que cuente games + wins del par exacto seleccionado. Si no, defer a backlog.

---

## 10. Sub-story 5 — Nueva temporada + cerrar polla

### `NewSeasonDialog` con type-to-confirm

```
┌─ Nueva temporada ───────────────────────────────────────┐
│  ⚠️  Vas a empezar la Temporada 2                       │
│                                                         │
│  Esto va a:                                             │
│    ✓ Archivar el leaderboard actual                     │
│    ✓ Resetear stats a 0 para todos                      │
│    ✓ El historial de partidas se mantiene               │
│    ✓ Los jugadores siguen siendo los mismos             │
│                                                         │
│  Escribí "nueva temporada" para confirmar:              │
│  [_______________]                                      │
│                                                         │
│  [Cancelar]              [Empezar Temporada 2 →]        │
└─────────────────────────────────────────────────────────┘
```

### Server action: `startNewSeason(tournamentId, confirmName)`

- Valida `confirmName.trim().toLowerCase() === 'nueva temporada'`.
- Valida `created_by = auth.uid()` (solo el founder).
- `update tournaments set current_season = current_season + 1`.
- Las nuevas partidas heredan ese season automáticamente via la lógica del pairing insert.

### Server action: `closePolla(tournamentId)`

- Valida `created_by = auth.uid()`.
- `update tournaments set status = 'finished'`.
- El botón "Nueva partida" del PollaHomePage se deshabilita cuando `status !== 'open'`.

### Diferido al MVP

UI del selector visual de "Temporada 1 / 2 / 3" para ver leaderboards históricos. Los datos quedan (`tournament_pairings.season` los preserva), la UI viene en polish posterior.

---

## 11. Testing strategy

### Unit tests (Vitest)

| File | Cubre |
|------|-------|
| `src/lib/__tests__/polla-rpc.test.ts` | Mock del client Supabase. Fixture de 5–6 partidas. Shape + ordering + math de `polla_standings`. `polla_best_partner` returns el correcto con tie-break por games. `calc_streak` con secuencias variadas. |
| `src/lib/__tests__/tournaments-schema.test.ts` (extender) | Acepta `format='polla'`, `is_open_ended`. |
| `src/lib/__tests__/polla-actions.test.ts` (nuevo) | `createTournament` con format polla persiste `current_season=1`. `createNewMatchInPolla` crea match con `format='doubles'` y `season=current_season`. `startNewSeason` incrementa season y valida nombre. |

### Component tests (Vitest jsdom)

| Component | Test |
|-----------|------|
| `PollaLeaderboard` | Render con 4 players + stats. Highlight player actual. Empty state. |
| `PartnerStatsCard` | Formato "8W-2L". `"—"` cuando no hay partner detectado. |
| `NewMatchInPollaModal` | Validación frontend: rechaza duplicados, menos de 2 por team, players fuera del roster. |

### E2E tests (Playwright, sub-story 5)

| File | Flujo |
|------|-------|
| `e2e/polla-create-and-play.spec.ts` | Crear polla → crear partida → confirmar → leaderboard actualizado. |
| `e2e/polla-new-season.spec.ts` | Polla con 3 partidas → nueva temporada → leaderboard en 0 → datos viejos preservados. |

### Lo que NO se testea

- `apply_match_rating` SQL — ya cubierto por tests existentes.
- Realtime updates del leaderboard.
- CSP / headers (fuera del scope).
- Coverage % gates.

---

## 12. Acceptance criteria por sub-story

Checklist concreto para tildar al cerrar cada commit.

### Sub-story 1a (✅ ya cumplido)
- [x] Migration `0039` agrega `'polla'` al enum de `tournaments.format`
- [x] Columnas `is_open_ended` + `current_season` agregadas
- [x] `tournament_pairings.season` + índice agregados
- [x] Vista `polla_current_season_pairings` creada
- [x] Migration idempotente, aplicada en Supabase prod

### Sub-story 1b (RPCs)
- [ ] Migration `0040_polla_rpcs.sql` crea `calc_streak`, `polla_standings`, `polla_best_partner`, `polla_worst_rival`
- [ ] Todas con `security definer set search_path = public`
- [ ] `grant execute ... to authenticated` en las 4
- [ ] `polla_standings` deriva wins/total_points de `match_players.score` (NO de columnas inexistentes)
- [ ] Unit tests con fixture de 5–6 partidas pasando

### Sub-story 2 (Wizard config)
- [ ] `tournament-schema.ts` acepta `format: 'polla'` y campo `is_open_ended: z.boolean().default(false)`
- [ ] Step 3: opción "Polla" con badge cultural 🇻🇪
- [ ] Step 2: cuando se elige polla, se fuerza `visibility='private'` con helper text
- [ ] Step 6 (Configuración): si format='polla', muestra selector "indefinida vs rondas fijas"
- [ ] Step 8 (tiempo/meta): cuando format='polla', se skipea (navega directo a step 9)
- [ ] Step 9 (Resumen): muestra config polla correcta + el toggle `rated` ya existente (PR #10)
- [ ] `createTournament` persiste `is_open_ended` + `current_season=1`

### Sub-story 3 (Polla home page)
- [ ] `/tournaments/[id]/page.tsx` branchea: si `format='polla'` renderiza `PollaHomePage`
- [ ] Header diferenciado: badge "Polla" + temporada actual + total partidas
- [ ] Botón "Nueva partida" prominente, visible para cualquier participante (no solo founder)
- [ ] `PollaLeaderboard` consume `polla_standings` y muestra: # / Jugador / Pts / W / L / % / Racha
- [ ] `PartnerStatsCard`: "Tu mejor partner: X (Yw-Zl)" + "Rival más fuerte: A (Bw-Cl)"
- [ ] `PollaRoundsAccordion`: agrupación visual cada N partidas (N = players/2), colapsable
- [ ] Acciones organizer visibles solo si `created_by = auth.uid()`: Editar nombre, Nueva temporada, Cerrar polla
- [ ] Mobile-first verificado a 375px

### Sub-story 4 (Nueva partida)
- [ ] Modal/bottom sheet `NewMatchInPollaModal` con dual-team selector
- [ ] Tap-to-pair UI: cada player se asigna a team A o B
- [ ] Validación: 2 players por team, todos del roster, sin duplicados
- [ ] Server action `createNewMatchInPolla(tournamentId, teamA, teamB)`:
  - Crea `tournament_pairings` con `season = current_season`
  - Crea `match` con `format='doubles'` (NO `'polla'`), `tournament_id` set
  - `matches.rated` hereda de `tournaments.rated` (ya funciona vía `startLiveMatch`)
- [ ] Al confirmar redirect a `/matches/[id]/live`
- [ ] Rate limit: `rl.matchStart` reutilizado, identifier `polla-match:${user.id}`

### Sub-story 5 (Nueva temporada + cerrar)
- [ ] `NewSeasonDialog` con type-to-confirm ("escribí 'nueva temporada'")
- [ ] Server action `startNewSeason(tournamentId, confirmName)`:
  - Valida `confirmName === 'nueva temporada'` (case-insensitive, trim)
  - Solo permite si `created_by = auth.uid()`
  - Incrementa `current_season`
  - Las nuevas partidas heredan ese season number automáticamente vía `pairing.season = t.current_season`
- [ ] Leaderboard filter por `current_season` (queries existentes lo hacen vía la vista)
- [ ] **Diferido al MVP**: selector visual de "Temporada 1 / 2 / 3" — solo guardamos los datos, UI viene en polish
- [ ] Server action `closePolla(tournamentId)`: marca `status='finished'`, deshabilita "Nueva partida"
- [ ] E2E tests del Playwright pasando

### Diferido / no aplica al MVP
- Stats preview de pairings repetidas ("Erik y vos han jugado 8 veces") — opcional en sub-story 4 si queda tiempo
- Selector histórico de temporadas anteriores en UI — backlog
- Badge "Amistosa" en cards de historial — PR aparte
- Push notif al crear partida — decisión #9, sin notif

---

## 13. Reporte final por sub-story

Al cerrar cada commit:

- Lista de archivos creados/modificados (paths absolutos).
- Output de `pnpm typecheck` + `pnpm test --run` + `pnpm build` (verdes).
- Mobile (375px) + desktop screenshots de vistas nuevas, adjuntos al PR body.
- Pasos manuales pendientes para vos (migrations a aplicar en Supabase prod, env vars si aplica).
- Limitaciones o decisiones tomadas por ambigüedad.

---

## 14. Riesgos conocidos

- **Wizard branching dinámico**: cambiar `router.push` en step 7 para skipear step 8 cuando format='polla'. Pequeño refactor, sin impacto en otros formatos si se hace con `if (draft.format === 'polla')`.
- **Performance del leaderboard**: `polla_standings` hace 2 subqueries por partida via la CTE. Con 100+ partidas puede ser lento. Mitigación: `EXPLAIN ANALYZE` en sub-story 5 y crear índice si hace falta.
- **Idempotencia de `startNewSeason`**: si el usuario hace doble-click, podría incrementar season 2 veces. Mitigación: validación en server action que rechace si el nombre no matchea exactamente, + lock de UI durante pending.

---

## 15. Migration order para deployment

Cuando se cierre el PR a main:

```bash
cd domino-app
supabase db push   # aplica 0039 + 0040
# 0039 ya está aplicada manualmente en prod por el usuario.
# 0040 se aplicará por primera vez al hacer push.
```

Sin redeploy de edge functions — polla no toca las edge functions existentes.
