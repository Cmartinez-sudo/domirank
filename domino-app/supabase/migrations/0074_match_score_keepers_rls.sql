-- ============================================================
-- 0074 — RLS en match_score_keepers
-- ============================================================
-- Hotfix de seguridad — resuelve el linter de Supabase ERROR:
--   "RLS Disabled in Public" en public.match_score_keepers.
--
-- Contexto:
--   • Tabla creada en 0057 sin RLS.
--   • Inserts/updates ocurren vía funciones SECURITY DEFINER:
--       - tg_auto_assign_score_keeper (mig 0073)  — trigger AFTER INSERT en matches
--       - transfer_score_keeper       (mig 0060)  — RPC de transferencia
--     Ambas con search_path fijo. Bypasean RLS por diseño → siguen funcionando.
--   • SELECTs internos vía can_record_hand (mig 0058), también SECURITY DEFINER.
--   • App-side (Next.js src/) NO consulta la tabla directamente.
--
-- Las policies son defense-in-depth: protegen ante un INSERT/SELECT/UPDATE
-- directo desde cliente que hoy no existe pero que mañana podría existir.
--
-- Dependencias: 0057 (tabla), 0060/0063/0073 (paths SECURITY DEFINER referenciados).
-- ============================================================

alter table public.match_score_keepers enable row level security;

-- SELECT: participantes del match O cualquier authenticated si el match es público.
create policy score_keepers_select_participants
  on public.match_score_keepers for select
  using (
    exists (
      select 1 from public.match_players mp
       where mp.match_id = match_score_keepers.match_id
         and mp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.matches m
       where m.id = match_score_keepers.match_id
         and m.visibility = 'public'
    )
  );

-- INSERT: host del match (matches.created_by) O el score-keeper actual.
-- assigned_by_user_id debe coincidir con el caller (audit anti-spoof).
create policy score_keepers_insert_host_or_current
  on public.match_score_keepers for insert
  with check (
    assigned_by_user_id = auth.uid()
    and (
      exists (
        select 1 from public.matches m
         where m.id = match_score_keepers.match_id
           and m.created_by = auth.uid()
      )
      or exists (
        select 1 from public.match_score_keepers existing
         where existing.match_id = match_score_keepers.match_id
           and existing.user_id = auth.uid()
           and existing.active = true
      )
    )
  );

-- UPDATE: host del match O el keeper actual (para marcar active=false al transferir).
create policy score_keepers_update_authorized
  on public.match_score_keepers for update
  using (
    exists (
      select 1 from public.matches m
       where m.id = match_score_keepers.match_id
         and m.created_by = auth.uid()
    )
    or user_id = auth.uid()
  );

-- DELETE: sin policy → denegado. Audit trail preservado.

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. RLS habilitada:
--      select relrowsecurity from pg_class
--       where oid = 'public.match_score_keepers'::regclass;
--    Esperado: true.
--
-- 2. Policies presentes:
--      select polname from pg_policy
--       where polrelid = 'public.match_score_keepers'::regclass;
--    Esperado: 3 filas
--      score_keepers_select_participants
--      score_keepers_insert_host_or_current
--      score_keepers_update_authorized
--
-- 3. Smoke (preview env):
--    a) Crear match → trigger tg_auto_assign_score_keeper inserta fila ok.
--    b) Como host del match → select * funciona, ve la fila.
--    c) Como user no-participante en match privado → select devuelve 0 filas.
--    d) INSERT directo desde cliente como user random → falla:
--         "new row violates row-level security policy"
--    e) transfer_score_keeper(<match>, <new_keeper>) llamado por current keeper
--       → pasa (SECURITY DEFINER bypassea RLS).
-- ============================================================
