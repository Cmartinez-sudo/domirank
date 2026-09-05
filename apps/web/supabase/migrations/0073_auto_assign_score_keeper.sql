-- ============================================================
-- 0073 — Auto-assign score_keeper on match creation
-- ============================================================
-- Sprint Match Cancellation — hot-fix descubierto en QA.
--
-- BUG: matches creadas post-PR #15 (mig 0058, active-match-awareness)
-- no tienen fila en match_score_keepers. La RLS policy
-- match_rounds_insert_score_keeper exige can_record_hand(match_id, uid)
-- que checa exists(match_score_keepers WHERE active=true). Sin la fila,
-- el INSERT a match_rounds revienta con:
--   "new row violates row-level security policy for table match_rounds"
--
-- Fix: trigger AFTER INSERT en matches que crea automáticamente la fila
-- inicial con user_id = created_by (creator = score-keeper inicial).
-- Cubre todos los flows: quick match, polla, tournament, sin tocar
-- código de aplicación.
--
-- También: backfill para matches in_progress sin keeper activo (data
-- creada entre PR #15 deploy y este fix).
--
-- Dependencias: 0057 (match_score_keepers table).
-- ============================================================

create or replace function public.tg_auto_assign_score_keeper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo seed inicial cuando el match arranca in_progress y aún no hay
  -- keeper. La asignación posterior (transfers) la maneja
  -- transfer_score_keeper RPC (mig 0060).
  if new.status = 'in_progress'
     and new.created_by is not null
     and not exists (
       select 1 from public.match_score_keepers
        where match_id = new.id and active = true
     )
  then
    insert into public.match_score_keepers
      (match_id, user_id, assigned_by_user_id, active)
    values
      (new.id, new.created_by, new.created_by, true);
  end if;
  return new;
end;
$$;

comment on function public.tg_auto_assign_score_keeper() is
  'AFTER INSERT trigger fn que asigna al creator como score-keeper inicial. Idempotente: skip si ya existe keeper activo (no rompe si transfer manual fue inmediato).';

drop trigger if exists trg_matches_assign_score_keeper on public.matches;

create trigger trg_matches_assign_score_keeper
  after insert on public.matches
  for each row
  execute function public.tg_auto_assign_score_keeper();

-- Backfill: matches in_progress sin keeper activo (creadas entre el
-- deploy de PR #15 y este fix).
insert into public.match_score_keepers (match_id, user_id, assigned_by_user_id, active, assigned_at)
select
  m.id,
  m.created_by,
  m.created_by,
  true,
  m.created_at
from public.matches m
where m.status = 'in_progress'
  and m.created_by is not null
  and not exists (
    select 1 from public.match_score_keepers k
     where k.match_id = m.id and k.active = true
  );

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. Crear nueva partida → match_score_keepers debe tener fila activa:
--      select * from public.match_score_keepers
--       where match_id = '<nueva-match-id>' and active = true;
--    Esperado: 1 fila con user_id = creator.
--
-- 2. INSERT a match_rounds debe pasar la RLS policy:
--      el creator puede meter manos sin error.
--
-- 3. Backfill: verifica que todas las in_progress tengan keeper:
--      select count(*) from public.matches m
--       where m.status = 'in_progress'
--         and not exists (
--           select 1 from public.match_score_keepers k
--            where k.match_id = m.id and k.active = true
--         );
--    Esperado: 0.
-- ============================================================
