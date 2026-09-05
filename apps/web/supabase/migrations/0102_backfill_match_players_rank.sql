-- ============================================================
-- Migration 0102: backfill match_players.rank en partidas confirmed
-- ============================================================
-- Contexto: cuando el torneo tenía rated=false Y requires_attestation=false,
-- las partidas confirmed no ejecutaban applyMatchRating → match_players.rank
-- quedaba NULL → el leaderboard mostraba 0V 0D para todos.
--
-- El bug se arregla en TS (live-match.ts siempre llama applyMatchRating,
-- que ahora sincroniza rank cuando rated=false). Este backfill limpia el
-- estado existente para que los torneos ya jugados se vean correctamente.
--
-- Lógica:
--   1. Para cada match confirmed con al menos un rank NULL:
--   2. Calcular el equipo ganador sumando match_rounds.points
--   3. Setear rank=1 a los match_players del team ganador, rank=2 al resto
--
-- Idempotente: solo actualiza donde rank IS NULL. Correr múltiples veces
-- es seguro.
-- ============================================================

with team_totals as (
  select
    mp.match_id,
    mp.team,
    coalesce(sum(mr.points), 0) as team_score
  from public.match_players mp
  left join public.match_rounds mr
    on mr.match_id = mp.match_id and mr.team = mp.team
  where mp.match_id in (
    select id from public.matches where status = 'confirmed'
  )
    and exists (
      select 1 from public.match_players mp2
      where mp2.match_id = mp.match_id and mp2.rank is null
    )
  group by mp.match_id, mp.team
),
winners as (
  select distinct on (match_id)
    match_id,
    team as winning_team
  from team_totals
  order by match_id, team_score desc
),
updates as (
  select
    mp.id,
    case
      when mp.team = w.winning_team then 1
      else 2
    end as new_rank
  from public.match_players mp
  join winners w on w.match_id = mp.match_id
  where mp.rank is null
)
update public.match_players mp
set rank = updates.new_rank
from updates
where mp.id = updates.id;

-- Log del backfill (no rompe si no hay filas)
do $$
declare
  affected int;
begin
  get diagnostics affected = row_count;
  raise notice 'Backfill 0102: no direct row_count, ver logs de queries anteriores';
end $$;
