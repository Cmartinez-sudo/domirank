-- ============================================================
-- 0053 — compute_reliability + update_player_reliability
-- ============================================================
-- Sprint Reliability NR — F1.2 del RELIABILITY_NR_HOW_IT_WORKS.md.
--
-- Dos funciones:
--   1. compute_reliability(uuid) — calcula los 4 factores + score
--      compuesto sin escribir nada. Retorna table row.
--   2. update_player_reliability(uuid) — llama compute_reliability,
--      escribe en profiles, retorna el score.
--
-- Fórmula (del spec):
--   reliability = min(100, round(
--     35 * volume_factor +
--     25 * recency_factor +
--     25 * attestation_factor +
--     15 * diversity_factor
--   ))
--
-- Donde:
--   volume      = min(1, attested_matches / 30)
--   recency     = min(1, matches_last_60d / 10)
--   attestation = attested_matches / total_matches  (penaliza self-reported)
--   diversity   = min(1, distinct_opponents / 15)
--
-- Adaptación al schema DomiRank:
--   • "attested_matches" = matches con status='confirmed' donde el user es match_player.
--   • "total_matches"    = matches no-cancelled donde el user es match_player
--     (incluye in_progress, pending_attestation, disputed). Esto castiga
--     correctamente cuando muchos quedaron sin firmar.
--   • "matches_last_60d" = matches confirmed con finished_at en últimos 60 días.
--   • "distinct_opponents" = users distintos del OTRO team en matches confirmed.
--
-- Dependencias: 0052 (columnas reliability_*).
-- ============================================================

create or replace function public.compute_reliability(p_user_id uuid)
returns table (
  score        smallint,
  volume       real,
  recency      real,
  attestation  real,
  diversity    real
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attested      int;
  v_total         int;
  v_last_60       int;
  v_distinct_opp  int;
  v_volume        real;
  v_recency       real;
  v_attestation   real;
  v_diversity     real;
begin
  -- 1. Total matches del user (excluyendo cancelled/void — esos no cuentan
  --    como participación seria). Distinct match_id por si el user aparece
  --    con team>1 (no debería pero defensivo).
  select count(distinct mp.match_id)
    into v_total
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
   where mp.user_id = p_user_id
     and m.status not in ('cancelled', 'void');

  -- 2. Matches confirmed (= attested) del user.
  select count(distinct mp.match_id)
    into v_attested
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
   where mp.user_id = p_user_id
     and m.status = 'confirmed';

  -- 3. Matches confirmed en últimos 60 días.
  select count(distinct mp.match_id)
    into v_last_60
    from public.match_players mp
    join public.matches m on m.id = mp.match_id
   where mp.user_id = p_user_id
     and m.status = 'confirmed'
     and m.finished_at > now() - interval '60 days';

  -- 4. Distinct opponents — users distintos del OTRO team en matches confirmed.
  --    En singles cada match aporta 1 opponent; en doubles aporta 2.
  select count(distinct opp.user_id)
    into v_distinct_opp
    from public.match_players self
    join public.match_players opp on opp.match_id = self.match_id
                                  and opp.team != self.team
    join public.matches m on m.id = self.match_id
   where self.user_id = p_user_id
     and m.status = 'confirmed';

  -- 5. Compute factors (real 0.0..1.0).
  v_volume      := least(1.0, v_attested::real / 30.0);
  v_recency     := least(1.0, v_last_60::real / 10.0);
  v_attestation := case when v_total > 0 then v_attested::real / v_total::real else 0 end;
  v_diversity   := least(1.0, v_distinct_opp::real / 15.0);

  -- 6. Compose score. min(100, round(35*v + 25*r + 25*a + 15*d))
  return query
  select
    least(100, round(35.0 * v_volume + 25.0 * v_recency + 25.0 * v_attestation + 15.0 * v_diversity))::smallint as score,
    v_volume     as volume,
    v_recency    as recency,
    v_attestation as attestation,
    v_diversity  as diversity;
end;
$$;

grant execute on function public.compute_reliability(uuid) to authenticated;

-- ============================================================
-- update_player_reliability(uuid)
-- ============================================================
-- Llama compute_reliability y persiste el resultado + timestamp.
-- Retorna el score nuevo (smallint) — útil para tests + logs.

create or replace function public.update_player_reliability(p_user_id uuid)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result record;
begin
  select * into v_result from public.compute_reliability(p_user_id);

  update public.profiles
     set reliability_score       = v_result.score,
         reliability_volume      = v_result.volume,
         reliability_recency     = v_result.recency,
         reliability_attestation = v_result.attestation,
         reliability_diversity   = v_result.diversity,
         reliability_updated_at  = now()
   where id = p_user_id;

  return v_result.score;
end;
$$;

grant execute on function public.update_player_reliability(uuid) to authenticated;

-- ============================================================
-- recompute_reliability_for_active_users(p_days int default 90)
-- ============================================================
-- Para el cron nightly: recomputa reliability para todos los users
-- con actividad en últimos p_days (default 90).
--
-- "Actividad" = al menos 1 match (cualquier status no-cancelled) en el
-- período. Cubre el caso de partidas en pending_attestation que pueden
-- afectar attestation_factor.
--
-- Retorna count de users actualizados.

create or replace function public.recompute_reliability_for_active_users(p_days int default 90)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_count int := 0;
begin
  for v_user_id in
    select distinct mp.user_id
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
     where m.status not in ('cancelled', 'void')
       and (m.finished_at > now() - (p_days || ' days')::interval
            or m.created_at > now() - (p_days || ' days')::interval)
  loop
    perform public.update_player_reliability(v_user_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.recompute_reliability_for_active_users(int) to authenticated;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Las 3 funciones existen:
--      select proname from pg_proc
--       where pronamespace = 'public'::regnamespace
--         and proname in ('compute_reliability',
--                         'update_player_reliability',
--                         'recompute_reliability_for_active_users');
--    Esperado: 3 filas.
--
-- 2. compute_reliability funciona contra un user real (sin escribir):
--      select * from public.compute_reliability(
--        (select id from public.profiles
--          where (singles_games + doubles_games) >= 10
--          limit 1)
--      );
--    Esperado: score 0..100, 4 factors 0..1.
--
-- 3. update_player_reliability persiste correctamente:
--      select reliability_score, reliability_updated_at
--        from public.profiles where id = '<user_id>'::uuid;
--    Esperado: updated_at NOT NULL después de update_player_reliability().
-- ============================================================
