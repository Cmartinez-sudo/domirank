# DomiRank — Security Audit Log

Log cronológico de fixes de seguridad aplicados. Complementa
`SECURITY_AUDIT.md` (reporte de auditoría general).

Formato por entrada: qué error había → qué fix se aplicó → fecha →
si requirió policies nuevas, cuáles.

---

## 2026-06-09 — Supabase Linter Hotfix (7 ERRORs)

**Branch:** `hotfix/supabase-security-linter`
**Spec:** `CLAUDE_CODE_SECURITY_FIX.md`
**Migraciones aplicadas:**
- `domino-app/supabase/migrations/0074_match_score_keepers_rls.sql`
- `domino-app/supabase/migrations/0075_views_security_invoker.sql`

### Errores detectados por el linter

| # | Issue | Severidad | Objeto |
|---|---|---|---|
| 1 | Security Definer View | ERROR | `public.active_matches_per_user` |
| 2 | Security Definer View | ERROR | `public.match_feed` |
| 3 | Security Definer View | ERROR | `public.match_live_state` |
| 4 | Security Definer View | ERROR | `public.tournament_standings` |
| 5 | Security Definer View | ERROR | `public.profile_ratings` |
| 6 | Security Definer View | ERROR | `public.continuous_league_current_season_pairings` |
| 7 | RLS Disabled in Public | ERROR | `public.match_score_keepers` |

### Fix aplicado

**Issues 1-6 (vistas SECURITY DEFINER):**
`ALTER VIEW ... SET (security_invoker = on)` para las 6 vistas. No
hubo drop+recreate. Las RLS de tablas subyacentes ya eran
correctas — verificado caso por caso en Explore previo a la
migración (ver "Análisis previo" abajo).

**Issue 7 (match_score_keepers sin RLS):**
`ENABLE ROW LEVEL SECURITY` + 3 policies:
- `score_keepers_select_participants` — SELECT a participantes del match
  o público si `matches.visibility = 'public'`.
- `score_keepers_insert_host_or_current` — INSERT a `created_by` del
  match o al keeper actual (active=true). `assigned_by_user_id` debe
  coincidir con `auth.uid()` (anti-spoof del audit).
- `score_keepers_update_authorized` — UPDATE a host del match o keeper
  actual.
- DELETE: sin policy → denegado por default. Preserva audit trail.

### Análisis previo (Explore)

Antes de migrar se mapeó el riesgo por vista:

| Vista | Tablas subyacentes | RLS subyacente | Riesgo |
|---|---|---|---|
| profile_ratings | profiles | `profiles_read_all USING true` | BAJO |
| match_feed | matches, match_players, profiles | `*_read_all USING true` | BAJO |
| match_live_state | matches, match_rounds | `matches_read_all`, `match_rounds_read_participants_or_spectators` (vía `can_spectate_match` SECURITY DEFINER) | BAJO |
| active_matches_per_user | match_players, matches, match_attestations | `*_read_all`; JOIN por match_players ya filtra por participante | BAJO |
| tournament_standings | tournaments, tournament_players, profiles, matches, match_players | todas `read_all USING true` | BAJO |
| continuous_league_current_season_pairings | tournament_pairings, tournaments | `tp_read_visible` (gating por torneo), `tournaments_read_all` | BAJO |

**Conclusión:** ninguna vista requirió policy adicional en tablas
subyacentes. Las RLS existentes ya cubrían los use cases.

### Paths SECURITY DEFINER que siguen funcionando tras habilitar RLS

Verificado que los siguientes paths bypasean RLS por diseño y NO se
rompen:

- `tg_auto_assign_score_keeper` (mig 0073, trigger AFTER INSERT en `matches`)
  — SECURITY DEFINER + `search_path = public`.
- `transfer_score_keeper(p_match_id, p_new_keeper_user_id)` (mig 0060)
  — SECURITY DEFINER + `search_path = public`.
- `can_record_hand(p_match_id, p_user_id)` (mig 0058) — SECURITY
  DEFINER + `search_path = public`.

### Policies nuevas añadidas

| Tabla | Policy | Acción | Caso protegido |
|---|---|---|---|
| `match_score_keepers` | `score_keepers_select_participants` | SELECT | Solo participantes ven la fila; público si match `visibility='public'` |
| `match_score_keepers` | `score_keepers_insert_host_or_current` | INSERT | Defense-in-depth: bloquea inserts directos no autorizados |
| `match_score_keepers` | `score_keepers_update_authorized` | UPDATE | Defense-in-depth: solo host del match o keeper actual |

### Verificación post-deploy (pendiente — preview env)

- [ ] `relrowsecurity = true` en `match_score_keepers`.
- [ ] 3 policies presentes en `pg_policy` para `match_score_keepers`.
- [ ] 6 vistas con `security_invoker=on` en `pg_class.reloptions`.
- [ ] Linter de Supabase: 7 errores resueltos, 0 nuevos.
- [ ] Smoke E2E: dashboard, match view, tournament view, continuous
      league view, feed, score-keeper transfer flow.
- [ ] Cross-user check: user A no puede leer match privado de user B.

### Rollback plan

Si algo se rompe en producción:

```sql
-- Vistas
alter view public.<view_name> set (security_invoker = off);

-- match_score_keepers
alter table public.match_score_keepers disable row level security;
```

Ambos rollbacks restauran la funcionalidad inmediatamente (a costa
de reabrir el hueco de seguridad). NO son solución permanente — si
algo falla hay que añadir la policy faltante y re-aplicar.

### Por qué importa

DomiRank vive de trust. El moat es la 3-of-4 attestation: la idea
de que la mesa valida lo que pasa. Si cualquier user pudiera tomar
control del score-keeper de una partida ajena o leer partidas
privadas, el trust se vaporiza. Estos fixes cierran ambos vectores.
