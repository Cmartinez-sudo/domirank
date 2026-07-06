-- ============================================================
-- 0096 — Code review fixes (post-Fase 6)
-- ============================================================
-- Tres fixes accionados del code review del refactor mayor:
--
--   #1 — Recrear view group_leaderboard con fallback de target_points.
--        Si una partida histórica tiene target_points=NULL, el cálculo
--        ce_delta devolvía NULL y la fila no contaba. Fallback a 100.
--
--   #2 — Función transfer_group_admin atómica. transferAdmin desde TS
--        hacía 3 UPDATEs sin transacción; si la 3ra fallaba el rollback
--        best-effort podía también fallar y dejar el grupo en estado
--        inconsistente (created_by != role='admin').
--
--   #3 — Advisory lock en enforce_group_member_limit. Race condition
--        cuando dos aceptaciones simultáneas llegan al límite de 100.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- #1 — group_leaderboard con fallback target_points
-- ────────────────────────────────────────────────────────────

drop view if exists public.group_leaderboard cascade;

create or replace view public.group_leaderboard as
with group_match_players as (
  select
    gma.group_id,
    m.id              as match_id,
    -- Defensive coalesce: si target_points es NULL en una partida vieja,
    -- usar 100 (default histórico) para que el CE no devuelva NULL y la
    -- partida no se pierda del leaderboard.
    coalesce(nullif(m.target_points, 0), 100) as target_points,
    mp.user_id,
    mp.team,
    mp.score          as player_score,
    mp.rank           as player_rank
  from public.group_match_attributions gma
  join public.matches m on m.id = gma.match_id
  join public.match_players mp on mp.match_id = m.id
  where m.status = 'confirmed'
),
per_match_player as (
  select
    gmp.group_id,
    gmp.match_id,
    gmp.target_points,
    gmp.user_id,
    gmp.player_rank,
    gmp.player_score,
    coalesce(my.my_team_score, gmp.player_score) as team_score,
    coalesce(opp.opp_score, 0)                    as opp_score
  from group_match_players gmp
  left join lateral (
    select sum(mp2.score) as my_team_score
      from public.match_players mp2
     where mp2.match_id = gmp.match_id
       and mp2.team = gmp.team
  ) my on true
  left join lateral (
    select sum(mp2.score) as opp_score
      from public.match_players mp2
     where mp2.match_id = gmp.match_id
       and mp2.team <> gmp.team
  ) opp on true
),
per_player_match_ce as (
  select
    pmp.group_id,
    pmp.user_id,
    pmp.player_rank,
    pmp.team_score,
    pmp.opp_score,
    pmp.target_points,
    case
      when pmp.player_rank = 1 then
        1.0 - (pmp.opp_score::numeric / pmp.target_points)
      else
        -(1.0 - (pmp.team_score::numeric / pmp.target_points))
    end as ce_delta
  from per_match_player pmp
),
user_stats as (
  select
    group_id,
    user_id,
    count(*)                                       as matches_played,
    sum(case when player_rank = 1 then 1 else 0 end) as wins,
    sum(case when player_rank <> 1 then 1 else 0 end) as losses,
    coalesce(sum(ce_delta), 0)::numeric(10,4)       as effectiveness_coefficient,
    sum(team_score)                                 as points_for,
    sum(opp_score)                                  as points_against
  from per_player_match_ce
  group by group_id, user_id
)
select
  us.group_id,
  us.user_id,
  us.matches_played,
  us.wins,
  us.losses,
  case
    when us.matches_played > 0
    then round((us.wins::numeric * 100 / us.matches_played), 1)
    else 0
  end                                                  as win_rate,
  us.effectiveness_coefficient,
  case
    when (us.points_for + us.points_against) > 0
    then round(us.points_for::numeric * 100 / (us.points_for + us.points_against), 1)
    else 0
  end                                                  as effectiveness_percent,
  us.points_for,
  us.points_against,
  (us.points_for - us.points_against)                  as diff,
  rank() over (
    partition by us.group_id
    order by us.wins desc,
             us.effectiveness_coefficient desc,
             us.points_for desc
  ) as rank
from user_stats us;

alter view public.group_leaderboard set (security_invoker = on);

grant select on public.group_leaderboard to authenticated;

comment on view public.group_leaderboard is
  'Leaderboard agregado por (group_id, user_id) con CE federado. target_points NULL → fallback 100. Sort: V→CE→PF.';

-- ────────────────────────────────────────────────────────────
-- #2 — transfer_group_admin atómica
-- ────────────────────────────────────────────────────────────

create or replace function public.transfer_group_admin(
  p_group_id    uuid,
  p_new_admin_id uuid
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_current_admin uuid;
begin
  -- Validar que el caller es el creator/admin actual.
  select created_by_user_id into v_current_admin
    from public.groups
   where id = p_group_id;

  if v_current_admin is null then
    raise exception 'group_not_found';
  end if;
  if v_current_admin <> auth.uid() then
    raise exception 'only_creator_can_transfer';
  end if;
  if v_current_admin = p_new_admin_id then
    raise exception 'already_admin';
  end if;

  -- Validar que el nuevo admin es miembro activo.
  if not exists (
    select 1 from public.group_members
     where group_id = p_group_id
       and user_id = p_new_admin_id
       and status = 'active'
  ) then
    raise exception 'new_admin_not_active_member';
  end if;

  -- Las 3 mutations dentro de la misma transacción implícita de la función.
  -- Si CUALQUIERA falla, todas se revierten automáticamente.

  -- 1. Actualizar created_by del grupo.
  update public.groups
     set created_by_user_id = p_new_admin_id
   where id = p_group_id;

  -- 2. Promover al nuevo admin.
  update public.group_members
     set role = 'admin'
   where group_id = p_group_id
     and user_id = p_new_admin_id;

  -- 3. Demote del viejo admin a member.
  update public.group_members
     set role = 'member'
   where group_id = p_group_id
     and user_id = v_current_admin;
end;
$$;

grant execute on function public.transfer_group_admin(uuid, uuid) to authenticated;

comment on function public.transfer_group_admin(uuid, uuid) is
  'Transfiere rol de admin del creator actual a otro miembro activo. Atómico (las 3 mutations corren en la misma TX).';

-- ────────────────────────────────────────────────────────────
-- #3 — Advisory lock en enforce_group_member_limit
-- ────────────────────────────────────────────────────────────

create or replace function public.enforce_group_member_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_active_count int;
begin
  -- Solo nos importa si esta operación resulta en una membership 'active'.
  if new.status is distinct from 'active' then
    return new;
  end if;

  -- Si es UPDATE y el viejo ya era 'active', no cambia el count.
  if tg_op = 'UPDATE' and old.status = 'active' and old.group_id = new.group_id then
    return new;
  end if;

  -- Serializar chequeos concurrentes para el mismo grupo. Sin esto,
  -- dos aceptaciones simultáneas con 99 members podían pasar el check
  -- y dejar el grupo en 101.
  perform pg_advisory_xact_lock(hashtext('group_member_limit:' || new.group_id::text));

  select count(*)
    into v_active_count
    from public.group_members
   where group_id = new.group_id
     and status = 'active'
     and (tg_op <> 'UPDATE' or id <> new.id);

  if v_active_count >= 100 then
    raise exception 'group_member_limit_reached'
      using detail = format('Group %s already has 100 active members.', new.group_id);
  end if;

  return new;
end;
$$;

-- El trigger ya existe (mig 0092), no hace falta recrearlo — solo reemplazamos
-- la función a la que apunta.

comment on function public.enforce_group_member_limit() is
  'Bloquea insert/update si el grupo ya tiene 100 members active. Usa advisory_xact_lock para serializar concurrent inserts por group_id.';

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1. transfer_group_admin existe.
--      select proname from pg_proc where proname='transfer_group_admin';
--
-- 2. View group_leaderboard usa coalesce.
--      select definition from pg_views where viewname='group_leaderboard';
--    Debería contener "coalesce(nullif(m.target_points".
--
-- 3. enforce_group_member_limit usa advisory lock.
--      select prosrc from pg_proc where proname='enforce_group_member_limit';
--    Debería contener "pg_advisory_xact_lock".
-- ============================================================
