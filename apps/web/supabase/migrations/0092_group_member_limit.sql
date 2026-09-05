-- ============================================================
-- 0092 — Trigger: límite hard de 100 miembros activos por grupo
-- ============================================================
-- Fase C+D — Fase 2 (membership flow).
-- Decisión #8 del grilling: techo de 100 members status='active' por grupo.
-- Protege contra abuso (10k-user groups) y mantiene performance del
-- group_leaderboard view.
--
-- Implementación: trigger BEFORE INSERT/UPDATE (no CHECK constraint
-- porque Postgres no soporta CHECK cross-row).
-- ============================================================

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

drop trigger if exists trg_enforce_group_member_limit on public.group_members;

create trigger trg_enforce_group_member_limit
  before insert or update on public.group_members
  for each row
  execute function public.enforce_group_member_limit();

comment on function public.enforce_group_member_limit() is
  'Bloquea insert/update si el grupo ya tiene 100 members con status=active. Fase C+D #8.';
