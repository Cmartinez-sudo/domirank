-- ============================================================
-- DomiRank · migración 0012
-- Atomicidad de finalize_match (review #1) + null-guard en
-- void_match (review #2).
--
-- finalize_match(p_match_id, p_updates):
--   - Reemplaza la versión JS que hacía 8+ writes secuenciales sin
--     transacción y era vulnerable a doble-finalize.
--   - Toma los nuevos μ/σ calculados por OpenSkill en JS y los
--     aplica atómicamente dentro de un único bloque PL/pgSQL.
--   - `for update` sobre matches previene que dos llamadas
--     concurrentes pasen la misma verificación de status.
--
-- LIMITACIÓN CONOCIDA (cross-match concurrency):
--   Si el mismo jugador finaliza 2 partidas distintas en ms de
--   diferencia, la segunda usa μ/σ calculados sobre baseline pre-1ra.
--   Es un lost-update de pequeña magnitud aceptable para MVP.
--   Mitigación futura: optimistic CC verificando mu_before vs
--   current_mu antes de actualizar.
--
-- void_match: añade chequeo NOT NULL en mu_before/sigma_before para
-- prevenir corrupción del perfil si snapshots están vacíos.
-- ============================================================

-- ── finalize_match: aplica updates atómicamente ────────────────
create or replace function public.finalize_match(
  p_match_id uuid,
  p_updates  jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match    record;
  v_update   jsonb;
  v_mu_col   text;
  v_sig_col  text;
  v_gms_col  text;
  v_win_col  text;
  v_los_col  text;
  v_user_id  uuid;
  v_rank     int;
  v_won      boolean;
  v_expected int;
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'array' then
    raise exception 'invalid_updates';
  end if;

  -- Lock match row: previene concurrent finalize/void
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.created_by is distinct from auth.uid() then raise exception 'not_authorized'; end if;
  if v_match.status <> 'in_progress' then raise exception 'not_finalizable'; end if;

  -- Validar que updates incluya a TODOS los jugadores
  select count(*) into v_expected from public.match_players where match_id = p_match_id;
  if jsonb_array_length(p_updates) <> v_expected then
    raise exception 'updates_count_mismatch';
  end if;

  -- Map rating bucket → profile columns
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
    v_mu_col  := 'singles_mu';        v_sig_col := 'singles_sigma';
    v_gms_col := 'singles_games';     v_win_col := 'singles_wins';     v_los_col := 'singles_losses';
  end if;

  -- Aplicar updates jugador por jugador
  for v_update in select * from jsonb_array_elements(p_updates)
  loop
    v_user_id := (v_update->>'user_id')::uuid;
    v_rank    := (v_update->>'rank')::int;

    if v_user_id is null or v_rank is null or v_rank < 1 then
      raise exception 'invalid_update_fields';
    end if;
    if v_update->>'mu_before' is null or v_update->>'sigma_before' is null
       or v_update->>'mu_after' is null or v_update->>'sigma_after' is null then
      raise exception 'invalid_update_fields';
    end if;

    v_won := v_rank = 1;

    -- Validar jugador en match
    if not exists (
      select 1 from public.match_players where match_id = p_match_id and user_id = v_user_id
    ) then
      raise exception 'user_not_in_match';
    end if;

    -- Snapshot en match_players
    update public.match_players set
      rank         = v_rank,
      mu_before    = (v_update->>'mu_before')::numeric,
      sigma_before = (v_update->>'sigma_before')::numeric,
      mu_after     = (v_update->>'mu_after')::numeric,
      sigma_after  = (v_update->>'sigma_after')::numeric
    where match_id = p_match_id and user_id = v_user_id;

    -- Update bucket rating + contadores
    execute format(
      $q$
        update public.profiles set
          %I = $1,
          %I = $2,
          %I = %I + 1,
          %I = %I + $3,
          %I = %I + $4
        where id = $5
      $q$,
      v_mu_col,  v_sig_col,
      v_gms_col, v_gms_col,
      v_win_col, v_win_col,
      v_los_col, v_los_col
    )
    using
      (v_update->>'mu_after')::numeric,
      (v_update->>'sigma_after')::numeric,
      case when v_won then 1 else 0 end,
      case when v_won then 0 else 1 end,
      v_user_id;
  end loop;

  -- Marcar match completed
  update public.matches
  set status = 'completed', finished_at = now()
  where id = p_match_id;
end;
$$;

grant execute on function public.finalize_match(uuid, jsonb) to authenticated;


-- ── void_match: añadir null-guard en snapshots ─────────────────
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
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'match_not_found'; end if;
  if v_match.created_by is distinct from auth.uid() then raise exception 'not_authorized'; end if;
  if v_match.status <> 'completed' then raise exception 'not_voidable'; end if;

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
    v_mu_col  := 'singles_mu';        v_sig_col := 'singles_sigma';
    v_gms_col := 'singles_games';     v_win_col := 'singles_wins';     v_los_col := 'singles_losses';
  end if;

  for v_player in
    select user_id, mu_before, sigma_before, rank
    from public.match_players
    where match_id = p_match_id
  loop
    -- Null-guard: nunca anular sin un snapshot válido
    if v_player.mu_before is null or v_player.sigma_before is null then
      raise exception 'corrupted_snapshot';
    end if;

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

  update public.matches
  set status = 'voided', finished_at = null
  where id = p_match_id;
end;
$$;

grant execute on function public.void_match(uuid) to authenticated;
