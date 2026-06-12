'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { computeStandings } from '@/lib/club-pro/compute-standings';
import type { Pair, Match, PairStanding } from '@/lib/club-pro/swiss-types';
import { RoundTimer } from './RoundTimer';
import { StandingsPanel } from './StandingsPanel';

type TournamentView = {
  id: string;
  name: string;
  display_slug: string;
  status: string;
  current_round_number: number | null;
  rounds_count: number;
  round_duration_minutes: number;
  target_points: number;
  started_at: string | null;
  finished_at: string | null;
  organization_name: string;
  organization_logo_url: string | null;
  brand_primary_color: string | null;
  tournament_logo_url: string | null;
  sponsor_1_logo_url: string | null;
  sponsor_2_logo_url: string | null;
};

type PairData = {
  id: string;
  player_a_name: string;
  player_b_name: string;
  initial_seed: number | null;
  withdrawn_at: string | null;
};

type MatchData = {
  id: string;
  round_id: string;
  table_number: number;
  pair_home_id: string;
  pair_away_id: string | null;
  pair_home_score: number | null;
  pair_away_score: number | null;
  status: string;
  round_number: number;
};

type RoundData = {
  id: string;
  round_number: number;
  started_at: string | null;
  ended_at: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'EN VIVO',
  finished: 'FINALIZADO',
};

export function DisplayClient({
  slug,
  initialTournament,
}: {
  slug: string;
  initialTournament: TournamentView;
}) {
  const [tournament, setTournament] = useState<TournamentView>(initialTournament);
  const [pairs, setPairs] = useState<PairData[]>([]);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const supabase = supabaseBrowser();

    const [tournamentRes, pairsRes, roundsRes, matchesRes] = await Promise.all([
      supabase
        .from('tournament_public_display')
        .select('*')
        .eq('display_slug', slug)
        .maybeSingle(),
      supabase
        .from('org_tournament_pairs')
        .select('id, player_a_name, player_b_name, initial_seed, withdrawn_at')
        .eq('tournament_id', initialTournament.id),
      supabase
        .from('org_tournament_rounds')
        .select('id, round_number, started_at, ended_at')
        .eq('tournament_id', initialTournament.id)
        .order('round_number', { ascending: true }),
      supabase
        .from('org_tournament_matches')
        .select(
          'id, round_id, table_number, pair_home_id, pair_away_id, pair_home_score, pair_away_score, status, org_tournament_rounds(round_number)',
        )
        .eq('tournament_id', initialTournament.id),
    ]);

    if (tournamentRes.data) setTournament(tournamentRes.data as TournamentView);
    setPairs((pairsRes.data ?? []) as PairData[]);
    setRounds((roundsRes.data ?? []) as RoundData[]);

    const matchesData = ((matchesRes.data ?? []) as unknown as Array<{
      id: string;
      round_id: string;
      table_number: number;
      pair_home_id: string;
      pair_away_id: string | null;
      pair_home_score: number | null;
      pair_away_score: number | null;
      status: string;
      org_tournament_rounds: { round_number: number } | null;
    }>).map((m) => ({
      id: m.id,
      round_id: m.round_id,
      table_number: m.table_number,
      pair_home_id: m.pair_home_id,
      pair_away_id: m.pair_away_id,
      pair_home_score: m.pair_home_score,
      pair_away_score: m.pair_away_score,
      status: m.status,
      round_number: m.org_tournament_rounds?.round_number ?? 0,
    }));
    setMatches(matchesData);
    setLoading(false);
  }, [slug, initialTournament.id]);

  useEffect(() => {
    void fetchData();

    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`display-${slug}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_tournament_matches', filter: `tournament_id=eq.${initialTournament.id}` },
        () => void fetchData(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'org_tournament_rounds', filter: `tournament_id=eq.${initialTournament.id}` },
        () => void fetchData(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'org_tournaments', filter: `id=eq.${initialTournament.id}` },
        () => void fetchData(),
      )
      .subscribe();

    // Polling fallback in case Realtime drops — every 15s.
    const interval = setInterval(() => void fetchData(), 15_000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchData, slug, initialTournament.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-2xl text-slate-400">Cargando torneo…</div>
      </div>
    );
  }

  const currentRound = rounds.find(
    (r) => r.round_number === tournament.current_round_number,
  );
  const currentRoundMatches = matches.filter(
    (m) => m.round_number === tournament.current_round_number,
  );
  const isFinished = tournament.status === 'finished';

  const enginePairs: Pair[] = pairs.map((p) => ({
    id: p.id,
    initialSeed: p.initial_seed,
    withdrawnAt: p.withdrawn_at,
  }));
  const engineMatches: Match[] = matches
    .filter((m) => m.status === 'finished' || m.status === 'bye')
    .map((m) => ({
      id: m.id,
      pairHomeId: m.pair_home_id,
      pairAwayId: m.pair_away_id,
      pairHomeScore: m.pair_home_score,
      pairAwayScore: m.pair_away_score,
      status: m.status as Match['status'],
      roundNumber: m.round_number,
    }));

  let standings: PairStanding[] = [];
  try {
    standings = computeStandings(enginePairs, engineMatches, tournament.target_points);
  } catch {
    standings = [];
  }
  const sortedStandings = [...standings].sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.effectivenessCoefficient !== b.effectivenessCoefficient) {
      return b.effectivenessCoefficient - a.effectivenessCoefficient;
    }
    if (a.pointsScored !== b.pointsScored) return b.pointsScored - a.pointsScored;
    const aVsB = a.headToHeadResults.get(b.pairId);
    if (aVsB === 'win') return -1;
    if (aVsB === 'loss') return 1;
    return a.pairId < b.pairId ? -1 : 1;
  });

  const pairById = new Map(pairs.map((p) => [p.id, p]));
  const brandColor =
    tournament.brand_primary_color && /^#[0-9a-f]{6}$/i.test(tournament.brand_primary_color)
      ? tournament.brand_primary_color
      : '#2563eb';

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header
        className="flex items-center justify-between border-b-2 px-12 py-6"
        style={{ borderBottomColor: brandColor }}
      >
        <div className="flex items-center gap-6">
          {(tournament.tournament_logo_url || tournament.organization_logo_url) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tournament.tournament_logo_url || tournament.organization_logo_url || ''}
              alt={tournament.name}
              className="h-24 max-w-[220px] object-contain"
            />
          )}
          <div>
            <div className="text-sm uppercase tracking-widest text-slate-400">
              {tournament.organization_name}
            </div>
            <h1 className="mt-1 text-4xl font-bold leading-tight">{tournament.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-10 text-right">
          <div>
            <div className="text-sm uppercase tracking-widest text-slate-400">
              Ronda
            </div>
            <div className="text-5xl font-bold leading-none">
              {tournament.current_round_number ?? 0}
              <span className="text-2xl text-slate-400"> / {tournament.rounds_count}</span>
            </div>
          </div>
          {!isFinished && currentRound?.started_at && (
            <RoundTimer
              startedAt={currentRound.started_at}
              durationMinutes={tournament.round_duration_minutes}
            />
          )}
          <div
            className={`rounded-full px-6 py-3 text-lg font-bold uppercase tracking-widest ${
              isFinished ? 'bg-amber-500 text-slate-900' : 'animate-pulse bg-red-600'
            }`}
          >
            {STATUS_LABEL[tournament.status] ?? tournament.status}
          </div>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 gap-10 px-12 py-8 lg:grid-cols-[780px_1fr]">
        {/* Standings */}
        <StandingsPanel standings={sortedStandings} pairById={pairById} />


        {/* Matches grid */}
        <section className="flex min-h-0 flex-col gap-3">
          <h2 className="text-sm uppercase tracking-widest text-slate-400">
            {isFinished
              ? 'Ronda final'
              : `Mesas — Ronda ${tournament.current_round_number ?? 0}`}
          </h2>
          {currentRoundMatches.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-700 px-6 py-16 text-center text-lg text-slate-400">
              Esperando inicio de la ronda…
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {currentRoundMatches.map((m) => {
                const home = pairById.get(m.pair_home_id);
                const away = m.pair_away_id ? pairById.get(m.pair_away_id) : null;
                const isBye = away === null;
                if (isBye) {
                  return (
                    <div
                      key={m.id}
                      className="rounded-lg border-2 border-amber-700 bg-amber-900/30 p-5"
                    >
                      <div className="text-sm uppercase tracking-widest text-amber-400">
                        Mesa {m.table_number} — Bye
                      </div>
                      <div className="mt-2 truncate text-xl font-semibold">
                        {home ? `${home.player_a_name} & ${home.player_b_name}` : '?'}
                      </div>
                    </div>
                  );
                }
                const isFinishedMatch = m.status === 'finished';
                return (
                  <div
                    key={m.id}
                    className={`rounded-lg border-2 p-5 ${
                      isFinishedMatch ? 'border-slate-700 bg-slate-900' : 'border-slate-600 bg-slate-800'
                    }`}
                  >
                    <div className="mb-3 text-sm uppercase tracking-widest text-slate-400">
                      Mesa {m.table_number}
                    </div>
                    <PlayerRow
                      name={home ? `${home.player_a_name} & ${home.player_b_name}` : '?'}
                      score={m.pair_home_score}
                      winner={
                        isFinishedMatch &&
                        (m.pair_home_score ?? 0) > (m.pair_away_score ?? 0)
                      }
                    />
                    <PlayerRow
                      name={away ? `${away.player_a_name} & ${away.player_b_name}` : '?'}
                      score={m.pair_away_score}
                      winner={
                        isFinishedMatch &&
                        (m.pair_away_score ?? 0) > (m.pair_home_score ?? 0)
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer
        className="flex items-center justify-between gap-6 border-t-2 px-12 py-5 text-sm text-slate-500"
        style={{ borderTopColor: brandColor }}
      >
        <div className="text-base">DomiRank · meta {tournament.target_points} tantos</div>
        <div className="flex items-center gap-8">
          {(tournament.sponsor_1_logo_url || tournament.sponsor_2_logo_url) && (
            <span className="text-xs uppercase tracking-widest text-slate-500">
              Patrocinan
            </span>
          )}
          {tournament.sponsor_1_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tournament.sponsor_1_logo_url}
              alt="Sponsor 1"
              className="h-16 max-w-[200px] object-contain"
            />
          )}
          {tournament.sponsor_2_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tournament.sponsor_2_logo_url}
              alt="Sponsor 2"
              className="h-16 max-w-[200px] object-contain"
            />
          )}
        </div>
      </footer>
    </div>
  );
}

function PlayerRow({
  name,
  score,
  winner,
}: {
  name: string;
  score: number | null;
  winner: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1.5 ${
        winner ? 'text-emerald-400' : ''
      }`}
    >
      <span className="truncate text-lg font-semibold">{name}</span>
      <span className="font-mono text-4xl font-bold tabular-nums">{score ?? '—'}</span>
    </div>
  );
}
