# DomiRank — Rating System (referencia técnica permanente)

**Estado**: vigente desde sprint Reliability NR (junio 2026).
**Reemplaza**: `docs/RATING.md` (OpenSkill-era, deprecated).
**Spec de producto**: `RELIABILITY_NR_HOW_IT_WORKS.md`.

---

## 1. Modelo de rating: Elo + MoV

DomiRank usa **Elo clásico** (no OpenSkill) con multiplicador por
**Margin of Victory** estilo FiveThirtyEight.

```
team_elo  = avg(partners)
expected  = 1 / (1 + 10^((opp_elo - my_elo) / 400))
MOVM      = log10(scoreDiff + 1) * (2.2 / (eloGap * 0.001 + 2.2))
delta     = round(K * MOVM * (actual - expected))
```

- `K` se escalona por experiencia + tier (4 niveles):
  - `40` (Provisional, games < 10)
  - `28` (Learning, elo < 1500)
  - `24` (Stable, 1500-1899)
  - `18` (Elite, 1900-2049)
  - `12` (Legend, ≥ 2050)
- Elo inicial: **1500** en cada bucket. Anchors display: Elo 1000 → 1.0, Elo 2200 → 20.0.

Implementación: `src/lib/rating.ts` (motor) + `src/lib/match-rating-compute.ts`
(payload writer) + `apply_match_rating(uuid, jsonb)` RPC en SQL.

## 2. Cuatro buckets por jugador

| Bucket          | Modalidad   | Columnas en `profiles`                                 |
| --------------- | ----------- | ------------------------------------------------------ |
| `d6_singles`    | 6-6 singles | `singles_elo`, `singles_games`, `singles_wins`...      |
| `d6_doubles`    | 6-6 parejas | `doubles_elo`, `doubles_games`...                      |
| `d9_singles`    | 9-9 singles | `d9_singles_elo`, `d9_singles_games`...                |
| `d9_doubles`    | 9-9 parejas | `d9_doubles_elo`, `d9_doubles_games`...                |
| **DomiRank Global** | promedio ponderado | `global_elo` (mantenido por triggers a nivel SQL) |

La view `profile_ratings` expone los 4 buckets + global + display 1-20
+ los campos de reliability/is_rated.

## 3. NR (Not Rated)

**Umbral**: 5 partidas confirmadas totales (suma de los 4 buckets).

**Columna canonical**: `profiles.is_rated` — `BOOLEAN GENERATED ALWAYS AS STORED`,
expresión:

```sql
(coalesce(singles_games, 0)
 + coalesce(doubles_games, 0)
 + coalesce(d9_singles_games, 0)
 + coalesce(d9_doubles_games, 0)) >= 5
```

Postgres mantiene el valor automáticamente. Índice parcial
`idx_profiles_is_rated` cubre queries del leaderboard.

**Helpers TS** en `src/lib/rating.ts`:

- `NR_THRESHOLD = 5`
- `isRated(profile)` — prefiere DB column, fallback a sumar buckets
- `getDisplayRating(profile)` — retorna `null` cuando NR
- `getReliabilityBucket(score)` — devuelve `{key, label, className}`

**UI**: cuando `!isRated`, el rating se sustituye por pill "NR" ámbar:

- `<RatingBadge games={...}/>` en listas (FriendCard, UserSearch, etc)
- Dashboard hero card: "NR" 3.5rem + badge "Calibrando" + progress n/5
- `/profile/[username]`: mismo tratamiento
- `<NROnboardingCard/>` extra en dashboard con tip de diversidad

## 4. Reliability Score (0-100%)

**Fórmula** (`compute_reliability(uuid)` en SQL):

```
score = min(100, round(
  35·volume + 25·recency + 25·attestation + 15·diversity
))
```

Donde cada factor es 0-1:

| Factor        | Peso | Definición                                                     | Meta = 1.0      |
| ------------- | ---- | -------------------------------------------------------------- | --------------- |
| `volume`      | 35%  | `min(1, attested_matches / 30)`                                | 30 partidas confirmed |
| `recency`     | 25%  | `min(1, matches_last_60d / 10)`                                | 10 en últimos 60 días |
| `attestation` | 25%  | `attested / total_non_cancelled`                               | 100% atestiguadas |
| `diversity`   | 15%  | `min(1, distinct_opponents / 15)`                              | 15 oponentes distintos |

**Donde**:
- `attested_matches` = matches con `status='confirmed'` join `match_players`
- `total_non_cancelled` = matches no `cancelled`/`void`
- `matches_last_60d` = confirmed con `finished_at > now() - interval '60 days'`
- `distinct_opponents` = users distintos del otro team en matches confirmed

**Persistencia**: 5 columnas en `profiles`:
- `reliability_score smallint` (0-100, check constraint)
- `reliability_volume real`, `reliability_recency real`,
  `reliability_attestation real`, `reliability_diversity real` (0-1 cada uno)
- `reliability_updated_at timestamptz`

**4 buckets visuales** (`getReliabilityBucket`):

| Score    | Bucket         | Color        |
| -------- | -------------- | ------------ |
| 0–29     | Calibrando     | gris         |
| 30–59    | En desarrollo  | ámbar        |
| 60–89    | Confiable      | verde claro  |
| 90–100   | Muy confiable  | verde brillante |

## 5. Mantenimiento — triggers + cron

### 5.1 Trigger `trg_reliability_on_match_status`

`AFTER UPDATE OF status ON public.matches` con `WHEN`:

```sql
old.status IS DISTINCT FROM new.status
AND ('confirmed' IN (old.status, new.status))
```

Dispara solo en transiciones relevantes (no en updates de score/notes).
Por cada participante del match, llama `update_player_reliability(uuid)`.

Sin riesgo de recursión: el trigger escribe en `profiles`, no en `matches`.

### 5.2 Cron diario `/api/cron/recompute-reliability`

Vercel Cron, schedule `30 3 * * *` (03:30 UTC, offset 30min de
`auto-confirm` para no competir por locks). Llama
`recompute_reliability_for_active_users(p_days=90)` que itera todos
los users con actividad en los últimos 90 días.

Safety net para:
- Decay temporal (recency cae sin haber matches nuevos)
- Diversity drift (opponent borra cuenta)
- Self-healing de inconsistencias por bugs/transacciones fallidas

Autorización: header `Authorization: Bearer ${CRON_SECRET}`.

## 6. Migraciones del sprint

| Migración | Qué hace                                                                |
| --------- | ----------------------------------------------------------------------- |
| `0052_add_reliability_columns.sql` | 7 columnas + 2 índices (parcial + DESC) |
| `0053_compute_reliability_function.sql` | 3 funciones SQL (compute, update, recompute) |
| `0054_reliability_triggers.sql` | Trigger AFTER UPDATE OF status        |
| `0055_backfill_reliability.sql` | DO block que llama update para users activos |
| `0056_is_rated_all_buckets_view.sql` | Fix expresión is_rated + expone fields en view |

## 7. Por qué reliability separado del rating

Mezclar "skill" (Elo) con "incertidumbre" (σ de OpenSkill) en un solo
número conservador (μ−3σ) era difícil de explicar al usuario final
("¿por qué bajó mi rating si gané?"). Separamos:

- **Rating** = qué tan bueno crees que eres → Elo limpio
- **Reliability** = qué tan confiable es esa medición → score 0-100% explicable factor a factor

Es la misma idea que **DUPR** (pickleball) usa con su "Reliability Score",
o **WTA** con su "ranking points + tournaments played" — separar magnitudes
ortogonales en lugar de fusionarlas en un número opaco.

## 8. Testing

- `src/lib/__tests__/reliability-helpers.test.ts` — 16 tests de helpers TS
- `src/components/__tests__/ReliabilityBadge.test.tsx` — 11 tests
  (boundaries de buckets + tooltip behavior)
- `src/components/__tests__/NROnboardingCard.test.tsx` — 9 tests (progress states)

Total: 36 tests específicos del sprint. Suite completa: 474+ passing.

## 9. Operación

### Recomputar reliability de un user manualmente

```sql
select public.update_player_reliability('<uuid>');
```

### Forzar recompute global ad-hoc

```sql
select public.recompute_reliability_for_active_users(365);
```

### Dispatch del cron manualmente (curl)

```bash
curl -X GET https://domirank.app/api/cron/recompute-reliability \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Query de salud post-deploy

```sql
select
  count(*) as total,
  count(*) filter (where is_rated) as rated,
  count(*) filter (where reliability_updated_at is not null) as backfilled,
  avg(reliability_score) filter (where is_rated) as avg_score_rated
from public.profiles;
```
