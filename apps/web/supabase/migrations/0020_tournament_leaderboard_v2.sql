-- ============================================================
-- DomiRank · migración 0020 — Tournament Leaderboard v2
--
-- Qué cambia:
--   1. Nueva tabla tournament_rank_snapshots para tracking de movimiento.
--   2. Función snapshot_tournament_ranks() que inserta un snapshot
--      por jugador después de cada match confirmado.
--   3. Trigger on matches(status) que llama a snapshot cuando
--      status pasa a 'confirmed' y tournament_id IS NOT NULL.
--   4. RPC get_tournament_standings(p_tournament_id) que reemplaza
--      la vista tournament_standings y devuelve el conjunto extendido
--      con streak, last5, y prev_rank.
--
-- NOTA: La vista tournament_standings original (0002) sigue existiendo
-- para backward-compatibility del código legacy en page.tsx hasta que
-- ese código sea reemplazado por el nuevo componente.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Tabla de snapshots de ranking
-- ────────────────────────────────────────────────────────────
create table if not exists public.tournament_rank_snapshots (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references auth.users(id)         on delete cascade,
  rank          int  not null,
  snapshot_at   timestamptz not null default now(),
  primary key (tournament_id, user_id, snapshot_at)
);

create index if not exists idx_rank_snap_lookup
  on public.tournament_rank_snapshots (tournament_id, snapshot_at desc);

alter table public.tournament_rank_snapshots enable row level security;

drop policy if exists rank_snap_read_all on public.tournament_rank_snapshots;
create policy rank_snap_read_all
  on public.tournament_rank_snapshots for select using (true);

-- ────────────────────────────────────────────────────────────
-- 2. Función que calcula el ranking actual y guarda snapshot
-- ────────────────────────────────────────────────────────────
create or replace function public.snapshot_tournament_ranks(p_tournament_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  insert into public.tournament_rank_snapshots (tournament_id, user_id, rank, snapshot_at)
  select
    p_tournament_id,
    ranked.user_id,
    ranked.rank,
    v_now
  from (
    select
      tp.user_id,
      row_number() over (
        order by
          coalesce(s.wins, 0)                                        desc,
          coalesce(s.win_pct, 0)                                     desc,
          coalesce(s.points_for, 0) - coalesce(s.points_against, 0) desc,
          coalesce(s.points_for, 0)                                  desc
      ) as rank
    from public.tournament_players tp
    left join (
      select
        mp.user_id,
        count(*)                                              as wins,
        case when count(*) = 0 then 0
             else round(sum(case when mp.rank = 1 then 1 else 0 end)::numeric / count(*) * 100, 1)
        end as win_pct,
        sum(mp.score)                                        as points_for,
        sum(opp.opp_score)                                   as points_against
      from public.matches m
      join public.match_players mp on mp.match_id = m.id
      join lateral (
        select coalesce(sum(mp2.score) filter (where mp2.team <> mp.team), 0) as opp_score
        from public.match_players mp2 where mp2.match_id = m.id
      ) opp on true
      where m.tournament_id = p_tournament_id
        and m.status = 'confirmed'
      group by mp.user_id
    ) s on s.user_id = tp.user_id
    where tp.tournament_id = p_tournament_id
  ) ranked;
end;
$$;

grant execute on function public.snapshot_tournament_ranks(uuid) to authenticated;
grant execute on function public.snapshot_tournament_ranks(uuid) to service_role;

-- ────────────────────────────────────────────────────────────
-- 3. Trigger: cuando match pasa a confirmed con tournament_id
-- ────────────────────────────────────────────────────────────
create or replace function public.trg_snapshot_on_confirmed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Solo actúa cuando status cambia a 'confirmed' y pertenece a un torneo
  if new.status = 'confirmed'
     and (old.status is distinct from 'confirmed')
     and new.tournament_id is not null then
    perform public.snapshot_tournament_ranks(new.tournament_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leaderboard_snapshot on public.matches;
create trigger trg_leaderboard_snapshot
  after update of status on public.matches
  for each row execute function public.trg_snapshot_on_confirmed();

-- ────────────────────────────────────────────────────────────
-- 4. RPC get_tournament_standings
-- Devuelve standings enriquecidos: streak, last5, prev_rank
-- ────────────────────────────────────────────────────────────
create or replace function public.get_tournament_standings(p_tournament_id uuid)
returns table (
  rank          bigint,
  user_id       uuid,
  username      text,
  display_name  text,
  avatar_url    text,
  wins          bigint,
  losses        bigint,
  win_pct       numeric,
  pf            bigint,
  pc            bigint,
  plus_minus    bigint,
  streak        text,
  last5         text[],
  prev_rank     int
)
language sql stable security definer set search_path = public
as $$
with
-- Todos los jugadores del torneo con su perfil
players as (
  select tp.user_id, p.username::text, p.display_name, p.avatar_url
  from public.tournament_players tp
  join public.profiles p on p.id = tp.user_id
  where tp.tournament_id = p_tournament_id
),
-- Stats globales por jugador en este torneo (solo confirmed)
stats as (
  select
    mp.user_id,
    count(*)                                                  as games,
    sum(case when mp.rank = 1 then 1 else 0 end)              as wins,
    sum(case when mp.rank <> 1 then 1 else 0 end)             as losses,
    sum(mp.score)                                             as points_for,
    sum(opp.opp_score)                                        as points_against
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  join lateral (
    select coalesce(sum(mp2.score) filter (where mp2.team <> mp.team), 0) as opp_score
    from public.match_players mp2 where mp2.match_id = m.id
  ) opp on true
  where m.tournament_id = p_tournament_id
    and m.status = 'confirmed'
  group by mp.user_id
),
-- Ranking actual calculado
ranked as (
  select
    pl.user_id,
    pl.username,
    pl.display_name,
    pl.avatar_url,
    coalesce(s.games, 0)                                          as games,
    coalesce(s.wins, 0)                                           as wins,
    coalesce(s.losses, 0)                                         as losses,
    coalesce(s.points_for, 0)                                     as points_for,
    coalesce(s.points_against, 0)                                 as points_against,
    case when coalesce(s.games,0) = 0 then 0::numeric
         else round(s.wins::numeric / s.games * 100, 1)
    end as win_pct,
    row_number() over (
      order by
        coalesce(s.wins, 0)                                       desc,
        case when coalesce(s.games,0)=0 then 0
             else round(s.wins::numeric / s.games * 100, 1) end   desc,
        coalesce(s.points_for,0) - coalesce(s.points_against,0)  desc,
        coalesce(s.points_for, 0)                                 desc
    ) as rank
  from players pl
  left join stats s on s.user_id = pl.user_id
),
-- Últimas 5 partidas por jugador (más reciente primero)
recent_matches as (
  select
    mp.user_id,
    case when mp.rank = 1 then 'W' else 'L' end as result,
    m.confirmed_at,
    row_number() over (
      partition by mp.user_id
      order by m.confirmed_at desc
    ) as rn
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  where m.tournament_id = p_tournament_id
    and m.status = 'confirmed'
),
last5_agg as (
  select
    user_id,
    -- Invertir para que el más viejo quede a la izquierda: ordena por rn desc
    array_agg(result order by rn desc) filter (where rn <= 5) as last5_newest_first
  from recent_matches
  group by user_id
),
-- Streak: cuenta los más recientes con mismo resultado
streak_raw as (
  select
    user_id,
    result as streak_result,
    count(*) as streak_len
  from (
    select
      user_id,
      result,
      rn,
      -- Detecta quiebre: si el resultado cambia vs el anterior, nuevo grupo
      row_number() over (partition by user_id order by rn)
      - row_number() over (partition by user_id, result order by rn) as grp
    from recent_matches
    where rn <= 20   -- suficiente para calcular racha
  ) x
  where grp = (
    select min(grp2) from (
      select
        user_id as u2,
        row_number() over (partition by user_id order by rn)
        - row_number() over (partition by user_id, result order by rn) as grp2
      from recent_matches rm2
      where rm2.user_id = x.user_id and rm2.rn <= 20
    ) sub
    where u2 = x.user_id
  )
  group by user_id, streak_result, grp
),
-- Penúltimo snapshot (prev_rank)
prev_snapshots as (
  select distinct on (user_id)
    user_id,
    rank as prev_rank
  from (
    select
      user_id,
      rank,
      snapshot_at,
      dense_rank() over (
        partition by user_id
        order by snapshot_at desc
      ) as snap_num
    from public.tournament_rank_snapshots
    where tournament_id = p_tournament_id
  ) snaps
  where snap_num = 2
  order by user_id
)
select
  r.rank,
  r.user_id,
  r.username,
  r.display_name,
  r.avatar_url,
  r.wins,
  r.losses,
  r.win_pct,
  r.points_for                                         as pf,
  r.points_against                                     as pc,
  (r.points_for - r.points_against)                   as plus_minus,
  coalesce(
    (sr.streak_len::text || sr.streak_result),
    '0W'
  )                                                    as streak,
  coalesce(l5.last5_newest_first, '{}'::text[])        as last5,
  ps.prev_rank
from ranked r
left join streak_raw sr         on sr.user_id = r.user_id
left join last5_agg l5          on l5.user_id = r.user_id
left join prev_snapshots ps     on ps.user_id = r.user_id
order by r.rank;
$$;

grant execute on function public.get_tournament_standings(uuid) to anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. Realtime: habilitar matches para subscribe en el cliente
-- (idempotente si ya estaba habilitado en migración previa)
-- ────────────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
end$$;
