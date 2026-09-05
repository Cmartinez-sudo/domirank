-- ============================================================
-- DomiRank · migración 0011
-- Anular partida: permite al creador revertir una partida ya
-- completada, restaurando los ratings previos de cada jugador.
--
-- Diseño:
--   - Estado 'voided' se añade a matches.status.
--   - void_match(uuid) es SECURITY DEFINER para poder actualizar
--     los perfiles de todos los jugadores (no solo el propio).
--     Verifica que quien llama sea el created_by del match.
--   - Los contadores (games, wins, losses) se decrementan con
--     floor(col - 1, 0) para nunca bajar de 0.
--   - Solo se pueden anular partidas en estado 'completed'.
--     Las partidas ya anuladas o en curso no son elegibles.
-- ============================================================

-- ── Añadir 'voided' al enum de estado ──────────────────────
alter table public.matches
  drop constraint if exists matches_status_check;

alter table public.matches
  add constraint matches_status_check
  check (status in ('completed', 'in_progress', 'cancelled', 'voided'));

-- ── Función SECURITY DEFINER para anular partida ──────────
create or replace function public.void_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match    record;
  v_player   record;
  v_mu_col   text;
  v_sig_col  text;
  v_gms_col  text;
  v_win_col  text;
  v_los_col  text;
begin
  -- Fetch match
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'match_not_found';
  end if;

  -- Only the creator can void
  if v_match.created_by is distinct from auth.uid() then
    raise exception 'not_authorized';
  end if;

  -- Only completed matches can be voided
  if v_match.status <> 'completed' then
    raise exception 'not_voidable';
  end if;

  -- Map format + set_size → profile columns
  if v_match.format = 'singles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_mu_col  := 'd9_singles_mu';     v_sig_col := 'd9_singles_sigma';
    v_gms_col := 'd9_singles_games';  v_win_col := 'd9_singles_wins';  v_los_col := 'd9_singles_losses';
  elsif v_match.format = 'doubles' and coalesce(v_match.set_size, 'd6') = 'd9' then
    v_mu_col  := 'd9_doubles_mu';     v_sig_col := 'd9_doubles_sigma';
    v_gms_col := 'd9_doubles_games';  v_win_col := 'd9_doubles_wins';  v_los_col := 'd9_doubles_losses';
  elsif v_match.format = 'doubles' then
    v_mu_col  := 'doubles_mu';        v_sig_col := 'doubles_sigma';
    v_gms_col := 'doubles_games';     v_win_col := 'doubles_wins';     v_los_col := 'doubles_losses';
  else
    -- singles d6 (default)
    v_mu_col  := 'singles_mu';        v_sig_col := 'singles_sigma';
    v_gms_col := 'singles_games';     v_win_col := 'singles_wins';     v_los_col := 'singles_losses';
  end if;

  -- Revert each player's rating snapshot
  for v_player in
    select user_id, mu_before, sigma_before, rank
    from public.match_players
    where match_id = p_match_id
  loop
    execute format(
      $q$
        update public.profiles set
          %I = $1,
          %I = $2,
          %I = greatest(%I - 1, 0),
          %I = greatest(%I - $3, 0),
          %I = greatest(%I - $4, 0)
        where id = $5
      $q$,
      v_mu_col,  v_sig_col,
      v_gms_col, v_gms_col,
      v_win_col, v_win_col,
      v_los_col, v_los_col
    )
    using
      v_player.mu_before,
      v_player.sigma_before,
      case when v_player.rank = 1 then 1 else 0 end,
      case when v_player.rank <> 1 then 1 else 0 end,
      v_player.user_id;
  end loop;

  -- Mark match as voided
  update public.matches
  set status = 'voided', finished_at = null
  where id = p_match_id;
end;
$$;

-- Only authenticated users can call it (the function itself enforces creator check)
grant execute on function public.void_match(uuid) to authenticated;
