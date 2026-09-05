-- ============================================================
-- DomiRank · migración 0021
-- Fix de RLS: match_players solo tenía INSERT y SELECT policies, faltaba
-- UPDATE. syncMatchScores (TS) intentaba `update match_players set score = X`
-- pero la RLS rechazaba silenciosamente. Resultado: match_players.score
-- siempre quedaba en 0, lo que rompía:
--   - finalizeMatch (validaba que ningún team llegó a meta cuando sí)
--   - applyMatchRating (ranking basado en scores en 0 → orden incorrecto)
--   - match_feed view y otras consultas que dependen del campo
--
-- También backfilleamos los scores históricos desde match_rounds.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. UPDATE policy: solo el creador del match puede actualizar
--    score de match_players (con eq("match_id") en el cliente)
-- ────────────────────────────────────────────────────────────
drop policy if exists match_players_update_owner on public.match_players;
create policy match_players_update_owner
  on public.match_players for update
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_players.match_id and m.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_players.match_id and m.created_by = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 2. Backfill: poblar match_players.score desde match_rounds
--    Aplica a TODAS las partidas existentes (in_progress, pending,
--    confirmed, disputed, void). Garantiza que el campo refleje
--    el estado real ya capturado en match_rounds.
-- ────────────────────────────────────────────────────────────
update public.match_players mp
   set score = coalesce(subq.team_score, 0)
  from (
    select mr.match_id, mr.team, sum(mr.points)::int as team_score
      from public.match_rounds mr
     group by mr.match_id, mr.team
  ) subq
 where mp.match_id = subq.match_id
   and mp.team     = subq.team;
