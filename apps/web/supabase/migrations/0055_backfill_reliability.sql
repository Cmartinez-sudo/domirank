-- ============================================================
-- 0055 — Backfill reliability_score para profiles existentes
-- ============================================================
-- Sprint Reliability NR — F1.5 del RELIABILITY_NR_HOW_IT_WORKS.md.
--
-- Después de 0052-0054 las nuevas filas y transiciones nuevas mantienen
-- reliability fresh. Pero las filas pre-existentes tienen
-- reliability_score=0 (default) sin haber sido computadas nunca.
--
-- Este script ejecuta update_player_reliability() una vez por cada
-- profile con al menos 1 match (cualquier status no-cancelled).
-- Profiles sin matches quedan en 0 — correcto, no hay data.
--
-- Idempotente: re-aplicar este script solo refresca scores; no
-- duplica nada.
--
-- Performance note: para 10k profiles activos esto es ~10k UPDATEs
-- en sequencia (~30-60s en remoto). Aceptable como one-shot. Si
-- esto crece, particionar en chunks.
--
-- Dependencias: 0053 (update_player_reliability), 0054 (trigger ya
-- activo, pero no afecta este backfill porque no estamos cambiando
-- match.status).
-- ============================================================

do $$
declare
  v_user_id uuid;
  v_count int := 0;
begin
  for v_user_id in
    select distinct mp.user_id
      from public.match_players mp
      join public.matches m on m.id = mp.match_id
     where m.status not in ('cancelled', 'void')
  loop
    perform public.update_player_reliability(v_user_id);
    v_count := v_count + 1;
  end loop;

  raise notice 'Backfilled reliability for % users', v_count;
end$$;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================
-- 1. Reliability poblada para users con matches:
--      select count(*) as total,
--             count(*) filter (where reliability_updated_at is not null) as backfilled
--        from public.profiles
--       where id in (select distinct user_id from public.match_players);
--    Esperado: total = backfilled.
--
-- 2. Distribución de scores:
--      select width_bucket(reliability_score, 0, 100, 10) as bucket,
--             count(*) from public.profiles
--       where reliability_updated_at is not null
--       group by bucket order by bucket;
--    Inspect: distribución razonable, no todos en 0 ni todos en 100.
--
-- 3. is_rated coherente con reliability:
--      select count(*) from public.profiles
--       where is_rated = true and reliability_score = 0;
--    Esperado: 0 filas (un user is_rated tiene >=5 matches confirmed,
--    debe tener score > 0).
-- ============================================================
