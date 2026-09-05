-- ============================================================
-- Migración 0103: count_rule (regla de conteo)
-- ============================================================
-- Reemplaza conceptualmente la "modalidad por país"
-- (ven/dom/cub/pri/custom) por una regla de conteo:
--   - 'rival': al cerrar mano, sumas solo fichas de contrincantes
--   - 'mesa':  al cerrar mano, sumas todas las fichas en mesa
--
-- Las columnas viejas (modality, default_modality, default_match_modality)
-- se CONSERVAN — no se borran. Sirven de histórico y dual-write.
--
-- set_size, target_points y capicua_bonus ya viven como columnas
-- independientes en matches; en user_preferences se agregan aquí
-- para que el "skip flow" pueda salir con los 4 defaults del usuario.
--
-- Backfill (idempotente):
--   modality vieja  →  count_rule
--     ven / dom / cub / custom / null  →  'rival'
--     pri                              →  'mesa'
--
-- Reversible: DROP COLUMN IF EXISTS revierte cada ADD.
-- ============================================================

-- ---------------- MATCHES ----------------
alter table public.matches
  add column if not exists count_rule text
    check (count_rule in ('rival', 'mesa'));

update public.matches
   set count_rule = case when modality = 'pri' then 'mesa' else 'rival' end
 where count_rule is null;

create index if not exists matches_count_rule_idx on public.matches (count_rule);

comment on column public.matches.count_rule is
  'Regla de conteo: rival (solo fichas contrincantes) o mesa (todas las fichas). Reemplaza el rol identitario de matches.modality.';

-- ---------------- TOURNAMENTS ----------------
alter table public.tournaments
  add column if not exists count_rule text
    check (count_rule in ('rival', 'mesa'));

update public.tournaments
   set count_rule = case when modality = 'pri' then 'mesa' else 'rival' end
 where count_rule is null;

comment on column public.tournaments.count_rule is
  'Regla de conteo del torneo. Los matches del torneo heredan este valor.';

-- ---------------- USER_PREFERENCES ----------------
-- 4 defaults del usuario: count_rule + set + target + capicúa.
-- Al activar skip_modality_prompt, el flujo de "nueva partida"
-- salta la pantalla de config con estos 4 valores.
alter table public.user_preferences
  add column if not exists default_count_rule text
    check (default_count_rule in ('rival', 'mesa')),
  add column if not exists default_set_size text
    check (default_set_size in ('d6', 'd9')),
  add column if not exists default_target_points integer
    check (default_target_points between 50 and 500),
  add column if not exists default_capicua_bonus integer
    check (default_capicua_bonus between 0 and 100);

update public.user_preferences
   set default_count_rule = case
         when default_match_modality = 'pri' then 'mesa'
         else 'rival'
       end,
       default_set_size = case
         when default_match_modality = 'cub' then 'd9'
         else 'd6'
       end,
       default_target_points = case
         when default_match_modality = 'ven' then 100
         when default_match_modality = 'dom' then 200
         when default_match_modality = 'cub' then 150
         when default_match_modality = 'pri' then 200
         else null
       end,
       default_capicua_bonus = case
         when default_match_modality = 'pri' then 50
         when default_match_modality in ('ven', 'dom', 'cub') then 30
         else null
       end
 where default_count_rule is null
   and default_match_modality is not null;

comment on column public.user_preferences.default_count_rule is
  'Regla de conteo por defecto del usuario. Reemplaza default_match_modality.';
comment on column public.user_preferences.default_set_size is
  'Tamaño de set (d6/d9) por defecto. Junto con los otros defaults, alimenta el skip flow al crear partida.';
comment on column public.user_preferences.default_target_points is
  'Meta de tantos por defecto (100/150/200 típicos, custom 50-500).';
comment on column public.user_preferences.default_capicua_bonus is
  'Bonus de capicúa por defecto (+30 típico, +50 en Mesa completa).';

-- ---------------- PROFILES ----------------
-- Se agrega default_count_rule por completitud (lecturas legacy que
-- consumen profiles directo). El source of truth para el skip flow
-- pasa a ser user_preferences.
alter table public.profiles
  add column if not exists default_count_rule text
    check (default_count_rule in ('rival', 'mesa'));

update public.profiles
   set default_count_rule = case
         when default_modality = 'pri' then 'mesa'
         when default_modality is null then null
         else 'rival'
       end
 where default_count_rule is null
   and default_modality is not null;

comment on column public.profiles.default_count_rule is
  'Regla de conteo derivada del onboarding. Legacy read-only; user_preferences es la fuente escritora.';

-- ---------------- Upsert defaults en user_preferences desde profiles ----------------
-- Para usuarios que completaron onboarding (tienen profiles.default_modality)
-- pero NO tienen row en user_preferences, creamos la row con los 4 defaults
-- derivados. Idempotente: only insert si no existe.
insert into public.user_preferences (
  user_id,
  default_count_rule,
  default_set_size,
  default_target_points,
  default_capicua_bonus,
  default_match_modality
)
select
  p.id,
  case when p.default_modality = 'pri' then 'mesa' else 'rival' end,
  case when p.default_modality = 'cub' then 'd9' else 'd6' end,
  case
    when p.default_modality = 'ven' then 100
    when p.default_modality = 'dom' then 200
    when p.default_modality = 'cub' then 150
    when p.default_modality = 'pri' then 200
    else null
  end,
  case
    when p.default_modality = 'pri' then 50
    when p.default_modality in ('ven', 'dom', 'cub') then 30
    else null
  end,
  case
    when p.default_modality in ('ven', 'dom', 'cub', 'pri') then p.default_modality
    else null
  end
from public.profiles p
where p.default_modality is not null
  and not exists (
    select 1 from public.user_preferences up where up.user_id = p.id
  )
on conflict (user_id) do nothing;
