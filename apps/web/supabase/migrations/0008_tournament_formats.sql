-- Fase 3: Múltiples formatos de torneo

alter table public.tournaments
  add column if not exists format text not null default 'rotation'
    check (format in ('rotation','round_robin','swiss','single_elim','double_elim','points_league'));

alter table public.tournaments
  add column if not exists current_round integer not null default 0;

alter table public.tournaments
  add column if not exists total_rounds integer;

-- Pareos asignados por el formato
create table if not exists public.tournament_pairings (
  id              bigserial primary key,
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  round           integer not null,
  board           integer not null,
  team_a_user_ids uuid[] not null,
  team_b_user_ids uuid[] not null,
  match_id        uuid references public.matches(id) on delete set null,
  winner_side     text check (winner_side in ('a','b')),
  created_at      timestamptz not null default now(),
  unique (tournament_id, round, board)
);

create index if not exists tp_tournament_round_idx
  on public.tournament_pairings (tournament_id, round);

alter table public.tournament_pairings enable row level security;

drop policy if exists tp_read_visible on public.tournament_pairings;
create policy tp_read_visible on public.tournament_pairings
  for select using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and (
        t.visibility = 'public'
        or t.created_by = auth.uid()
        or exists (
          select 1 from public.tournament_players tp2
          where tp2.tournament_id = t.id and tp2.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists tp_write_creator on public.tournament_pairings;
create policy tp_write_creator on public.tournament_pairings
  for all using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_id and t.created_by = auth.uid()
    )
  );
