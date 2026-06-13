'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
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
        .eq('tournament_id', initialTournament.id)
        .order('table_number', { ascending: true }),
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
  const currentRoundMatches = matches
    .filter((m) => m.round_number === tournament.current_round_number)
    .sort((a, b) => a.table_number - b.table_number);
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
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header — DomiRank | Tournament branding | Round/Timer/Live */}
      <header
        className="flex shrink-0 items-center gap-6 border-b-2 px-6 py-4"
        style={{ borderBottomColor: brandColor }}
      >
        {/* Left — DomiRank brand */}
        <div className="shrink-0 p-4">
          <Image
            src="/branding/logo-square-tagline.svg"
            alt="DomiRank"
            width={200}
            height={200}
            priority
            className="h-auto w-[clamp(120px,10vw,200px)]"
          />
        </div>

        {/* Center — tournament co-branding (flex-1 to fill) */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-4">
          {tournament.organization_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tournament.organization_logo_url}
              alt={tournament.organization_name}
              className="h-[clamp(60px,6vw,100px)] w-auto shrink-0 object-contain"
            />
          )}
          <div className="min-w-0 text-center">
            <h1 className="truncate text-[clamp(20px,2.2vw,40px)] font-bold leading-tight text-white">
              {tournament.name}
            </h1>
            {tournament.organization_name && (
              <p className="mt-1 truncate text-xs uppercase tracking-wider text-slate-400">
                {tournament.organization_name}
              </p>
            )}
          </div>
        </div>

        {/* Right — Round / Timer / Live */}
        <div className="flex shrink-0 items-center gap-[clamp(16px,2vw,40px)] text-right">
          <div>
            <div className="text-sm font-medium uppercase tracking-wider text-slate-400">
              Ronda
            </div>
            <div className="text-[clamp(28px,3vw,48px)] font-mono font-bold leading-none tabular-nums">
              {tournament.current_round_number ?? 0}
              <span className="text-[clamp(16px,1.5vw,24px)] text-slate-400">
                /{tournament.rounds_count}
              </span>
            </div>
          </div>
          {!isFinished && currentRound?.started_at && (
            <RoundTimer
              startedAt={currentRound.started_at}
              durationMinutes={tournament.round_duration_minutes}
            />
          )}
          <span
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest ${
              isFinished ? 'bg-amber-500 text-slate-900' : 'animate-pulse bg-red-600'
            }`}
          >
            {STATUS_LABEL[tournament.status] ?? tournament.status}
          </span>
        </div>
      </header>

      {/* Main fills all available vertical/horizontal space — 60/40 split favoring standings */}
      <main className="grid min-h-0 flex-1 grid-cols-[60%_40%] gap-[1vw] px-[1vw] py-[1vh]">
        {/* Standings */}
        <StandingsPanel standings={sortedStandings} pairById={pairById} />

        {/* Matches grid — compacter cards because column is narrower now */}
        <section className="flex min-h-0 flex-col gap-3">
          <h2 className="shrink-0 text-sm font-medium uppercase tracking-wider text-slate-400">
            {isFinished
              ? 'Ronda final'
              : `Mesas — Ronda ${tournament.current_round_number ?? 0}`}
          </h2>
          {currentRoundMatches.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-700 text-lg text-slate-400">
              Esperando inicio de la ronda…
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-3 overflow-hidden">
              {currentRoundMatches.map((m) => {
                const home = pairById.get(m.pair_home_id);
                const away = m.pair_away_id ? pairById.get(m.pair_away_id) : null;
                const isBye = away === null;
                if (isBye) {
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col justify-center gap-2 rounded-xl border border-amber-700 bg-amber-900/30 px-4 py-3"
                    >
                      <div className="text-xs font-medium uppercase tracking-wider text-amber-400">
                        Mesa {m.table_number} — Bye
                      </div>
                      <div className="truncate text-[clamp(16px,1.4vw,24px)] font-medium">
                        {home ? `${home.player_a_name} & ${home.player_b_name}` : '?'}
                      </div>
                    </div>
                  );
                }
                const isFinishedMatch = m.status === 'finished';
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col justify-between rounded-xl border px-4 py-3 ${
                      isFinishedMatch ? 'border-slate-700 bg-slate-900' : 'border-slate-600 bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                      Mesa {m.table_number}
                    </div>
                    <div className="flex flex-col gap-2">
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
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer
        className="flex shrink-0 items-center justify-between gap-6 border-t-2 px-6 py-4 text-slate-500"
        style={{ borderTopColor: brandColor }}
      >
        <div className="text-sm">
          Meta <span className="font-semibold text-slate-300">{tournament.target_points}</span> tantos
        </div>
        <div className="flex items-center gap-6">
          {(tournament.sponsor_1_logo_url || tournament.sponsor_2_logo_url) && (
            <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
              Patrocinan
            </span>
          )}
          {tournament.sponsor_1_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tournament.sponsor_1_logo_url}
              alt="Sponsor 1"
              className="h-[clamp(64px,9vh,128px)] w-auto object-contain"
            />
          )}
          {tournament.sponsor_2_logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tournament.sponsor_2_logo_url}
              alt="Sponsor 2"
              className="h-[clamp(64px,9vh,128px)] w-auto object-contain"
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
      className={`flex items-baseline justify-between gap-3 ${
        winner ? 'text-emerald-400' : ''
      }`}
    >
      <span className="min-w-0 truncate text-[clamp(14px,1.2vw,20px)] font-medium">{name}</span>
      <span className="shrink-0 font-mono text-[clamp(22px,2vw,32px)] font-bold leading-none tabular-nums">
        {score ?? '—'}
      </span>
    </div>
  );
}
