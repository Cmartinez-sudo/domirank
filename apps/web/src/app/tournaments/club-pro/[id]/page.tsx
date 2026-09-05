import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { computeStandings } from '@/lib/club-pro/compute-standings';
import { formatPairName, isIndividualFormat } from '@/lib/club-pro/pair-display';
import type { Pair, Match, PairStanding } from '@/lib/club-pro/swiss-types';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Próximamente',
  registration: 'Registro abierto',
  ready: 'Listo para iniciar',
  in_progress: 'En curso',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};

export async function generateMetadata() {
  return { title: 'Mi torneo · DomiRank', robots: { index: false, follow: false } };
}

type PairData = {
  id: string;
  player_a_name: string;
  player_a_email: string;
  player_a_user_id: string | null;
  player_b_name: string | null;
  player_b_email: string | null;
  player_b_user_id: string | null;
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

export default async function PlayerTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from('org_tournaments')
    .select(
      'id, name, status, format, rounds_count, current_round_number, target_points, round_duration_minutes, display_slug, organization_id, organizations(name, logo_url, brand_primary_color)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!tournament) notFound();

  const org = (tournament as unknown as {
    organizations: { name: string; logo_url: string | null; brand_primary_color: string | null } | null;
  }).organizations;

  // Find the user's pair in this tournament.
  const { data: myPair } = await supabase
    .from('org_tournament_pairs')
    .select('*')
    .eq('tournament_id', tournament.id)
    .or(`player_a_user_id.eq.${user.id},player_b_user_id.eq.${user.id}`)
    .maybeSingle();

  if (!myPair) {
    return (
      <div className="mx-auto mt-16 max-w-md px-4">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h1 className="text-xl font-bold">No estás inscrito en este torneo</h1>
          <p className="mt-2 text-sm text-slate-600">
            Solo los jugadores invitados pueden ver esta página. Si esperabas
            estar aquí, contacta al organizador.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Volver al dashboard
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: pairsRaw }, { data: matchesRaw }] = await Promise.all([
    supabase
      .from('org_tournament_pairs')
      .select(
        'id, player_a_name, player_a_email, player_a_user_id, player_b_name, player_b_email, player_b_user_id, initial_seed, withdrawn_at',
      )
      .eq('tournament_id', tournament.id),
    supabase
      .from('org_tournament_matches')
      .select(
        'id, round_id, table_number, pair_home_id, pair_away_id, pair_home_score, pair_away_score, status, org_tournament_rounds(round_number)',
      )
      .eq('tournament_id', tournament.id),
  ]);

  const pairs = (pairsRaw ?? []) as PairData[];
  const matches = ((matchesRaw ?? []) as unknown as Array<{
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
  })) as MatchData[];

  const pairById = new Map(pairs.map((p) => [p.id, p]));
  const isIndividual = isIndividualFormat(tournament.format);
  const partnerName = isIndividual
    ? null
    : myPair.player_a_user_id === user.id
      ? myPair.player_b_name
      : myPair.player_a_name;

  // Compute standings.
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
  const sorted = [...standings].sort((a, b) => {
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
  const myPosition = sorted.findIndex((s) => s.pairId === myPair.id) + 1;
  const myStanding = sorted.find((s) => s.pairId === myPair.id);

  // Find current-round match for the user's pair.
  const currentRoundMatches = matches.filter((m) => m.round_number === tournament.current_round_number);
  const myCurrentMatch = currentRoundMatches.find(
    (m) => m.pair_home_id === myPair.id || m.pair_away_id === myPair.id,
  );
  const myOpponentPair = myCurrentMatch
    ? myCurrentMatch.pair_home_id === myPair.id
      ? myCurrentMatch.pair_away_id
        ? pairById.get(myCurrentMatch.pair_away_id)
        : null
      : pairById.get(myCurrentMatch.pair_home_id)
    : null;

  // Past matches of the user's pair.
  const myPastMatches = matches
    .filter(
      (m) =>
        (m.pair_home_id === myPair.id || m.pair_away_id === myPair.id) &&
        (m.status === 'finished' || m.status === 'bye'),
    )
    .sort((a, b) => b.round_number - a.round_number);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <header>
        <Link
          href="/dashboard"
          className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
        >
          ← Dashboard
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">
              {org?.name ?? 'Organización'}
            </div>
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
          </div>
          <Link
            href={`/t/${tournament.display_slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            Ver display público →
          </Link>
        </div>
        <div className="mt-2 text-sm text-slate-600">
          Estado: {STATUS_LABEL[tournament.status] ?? tournament.status} ·{' '}
          Ronda {tournament.current_round_number ?? 0} / {tournament.rounds_count}
        </div>
      </header>

      {/* My pair card */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">
          {isIndividual ? 'Mi participación' : 'Mi pareja'}
        </h2>
        <p className="mt-1 text-lg font-semibold">
          {isIndividual ? 'Tú' : `Tú & ${partnerName}`}
        </p>
        {myStanding && (
          <p className="mt-1 text-sm text-slate-600">
            Posición <strong>#{myPosition}</strong> · {myStanding.wins}{' '}
            {myStanding.wins === 1 ? 'victoria' : 'victorias'} · CE{' '}
            {myStanding.effectivenessCoefficient.toFixed(2)} ·{' '}
            {myStanding.pointsScored} tantos
          </p>
        )}
        {myPair.withdrawn_at && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {isIndividual ? 'Te retiraste del torneo.' : 'Esta pareja se retiró del torneo.'}
          </p>
        )}
      </section>

      {/* Current match */}
      {myCurrentMatch && tournament.status === 'in_progress' && (
        <section
          className="rounded-lg border-2 p-4"
          style={{
            borderColor: org?.brand_primary_color ?? '#2563eb',
            backgroundColor: org?.brand_primary_color ? `${org.brand_primary_color}10` : '#eff6ff',
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-slate-700">
              Tu próxima mesa
            </h2>
            {myCurrentMatch.status === 'finished' && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                ✓ Terminada
              </span>
            )}
          </div>
          {myCurrentMatch.pair_away_id === null ? (
            <>
              <p className="mt-2 text-2xl font-bold">Bye 🛌</p>
              <p className="text-sm text-slate-600">Descansás esta ronda. +1 victoria gratis.</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                Mesa {myCurrentMatch.table_number}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                vs <strong>{formatPairName(myOpponentPair)}</strong>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Partida a {tournament.target_points} tantos.
              </p>
              {myCurrentMatch.status === 'finished' && (
                <p className="mt-2 text-lg font-semibold">
                  {myCurrentMatch.pair_home_id === myPair.id
                    ? `${myCurrentMatch.pair_home_score} - ${myCurrentMatch.pair_away_score}`
                    : `${myCurrentMatch.pair_away_score} - ${myCurrentMatch.pair_home_score}`}
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* Past matches */}
      {myPastMatches.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-widest text-slate-500">
            Mis partidas
          </h2>
          <ul className="mt-2 space-y-2">
            {myPastMatches.map((m) => {
              const isHome = m.pair_home_id === myPair.id;
              const isBye = m.pair_away_id === null;
              const myScore = isHome ? m.pair_home_score : m.pair_away_score;
              const oppScore = isHome ? m.pair_away_score : m.pair_home_score;
              const oppPair = isBye
                ? null
                : pairById.get(isHome ? (m.pair_away_id as string) : m.pair_home_id);
              const won = isBye || (myScore ?? 0) > (oppScore ?? 0);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500">Ronda {m.round_number}</div>
                    <div className="truncate">
                      {isBye
                        ? 'Bye 🛌'
                        : `vs ${formatPairName(oppPair)}`}
                    </div>
                  </div>
                  <div className={`font-mono font-bold ${won ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {isBye ? '✓' : `${myScore ?? 0} - ${oppScore ?? 0}`}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Top 5 standings */}
      {sorted.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-widest text-slate-500">Top 5</h2>
          <ol className="mt-2 space-y-1">
            {sorted.slice(0, 5).map((s, idx) => {
              const p = pairById.get(s.pairId);
              const name = formatPairName(p);
              const isMe = s.pairId === myPair.id;
              return (
                <li
                  key={s.pairId}
                  className={`flex items-center gap-3 px-2 py-1 text-sm ${isMe ? 'rounded bg-slate-100 font-semibold' : ''}`}
                >
                  <span className="w-6 text-right text-slate-500">{idx + 1}</span>
                  <span className="flex-1 truncate">{name}</span>
                  <span className="font-mono">{s.wins}</span>
                </li>
              );
            })}
          </ol>
          <Link
            href={`/t/${tournament.display_slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center text-xs text-slate-500 underline hover:text-slate-700"
          >
            Ver clasificación completa
          </Link>
        </section>
      )}
    </div>
  );
}
