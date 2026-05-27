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
