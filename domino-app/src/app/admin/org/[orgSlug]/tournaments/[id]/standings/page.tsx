import { notFound } from 'next/navigation';
import { requireOrgMember } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { computeStandings } from '@/lib/club-pro/compute-standings';
import type { Pair, Match } from '@/lib/club-pro/swiss-types';

export const dynamic = 'force-dynamic';

type PairFull = {
  id: string;
  player_a_name: string;
  player_b_name: string;
  initial_seed: number | null;
  withdrawn_at: string | null;
};

type MatchRow = {
  id: string;
  pair_home_id: string;
  pair_away_id: string | null;
  pair_home_score: number | null;
  pair_away_score: number | null;
  status: string;
  org_tournament_rounds: { round_number: number } | null;
};

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org } = await requireOrgMember(orgSlug);
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from('org_tournaments')
    .select('id, target_points, status, current_round_number')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle();
  if (!tournament) notFound();

  const [{ data: pairsRaw }, { data: matchesRaw }] = await Promise.all([
    supabase
      .from('org_tournament_pairs')
      .select('id, player_a_name, player_b_name, initial_seed, withdrawn_at')
      .eq('tournament_id', tournament.id),
    supabase
      .from('org_tournament_matches')
      .select(
        'id, pair_home_id, pair_away_id, pair_home_score, pair_away_score, status, org_tournament_rounds(round_number)',
      )
      .eq('tournament_id', tournament.id)
      .in('status', ['finished', 'bye']),
  ]);

  const pairs = (pairsRaw ?? []) as PairFull[];
  const matchesData = (matchesRaw ?? []) as unknown as MatchRow[];

  const enginePairs: Pair[] = pairs.map((p) => ({
    id: p.id,
    initialSeed: p.initial_seed,
    withdrawnAt: p.withdrawn_at,
  }));

  const engineMatches: Match[] = matchesData.map((m) => ({
    id: m.id,
    pairHomeId: m.pair_home_id,
    pairAwayId: m.pair_away_id,
    pairHomeScore: m.pair_home_score,
    pairAwayScore: m.pair_away_score,
    status: m.status as Match['status'],
    roundNumber: m.org_tournament_rounds?.round_number ?? 0,
  }));

  let standings;
  try {
    standings = computeStandings(enginePairs, engineMatches, tournament.target_points);
  } catch (e) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Error al calcular standings: {String(e instanceof Error ? e.message : e)}
      </div>
    );
  }

  // Sort by the FIXED domino-federated order.
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

  const pairById = new Map(pairs.map((p) => [p.id, p]));

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
        Sin standings — todavía no hay partidas finalizadas.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Pareja</th>
            <th className="px-3 py-2 text-right">PG</th>
            <th className="px-3 py-2 text-right">PP</th>
            <th className="px-3 py-2 text-right">CE</th>
            <th className="px-3 py-2 text-right">Tantos</th>
            <th className="px-3 py-2 text-right">Bye</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((s, idx) => {
            const p = pairById.get(s.pairId);
            return (
              <tr key={s.pairId} className={s.withdrawn ? 'opacity-50' : ''}>
                <td className="px-3 py-2 font-mono text-xs">{idx + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {p ? `${p.player_a_name} & ${p.player_b_name}` : s.pairId}
                  </div>
                  {s.withdrawn && (
                    <span className="text-xs text-red-700">Retirada</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold">{s.wins}</td>
                <td className="px-3 py-2 text-right text-slate-500">{s.losses}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {s.effectivenessCoefficient.toFixed(3)}
                </td>
                <td className="px-3 py-2 text-right">{s.pointsScored}</td>
                <td className="px-3 py-2 text-right text-xs text-slate-500">
                  {s.hasHadBye ? '✓' : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <strong>PG</strong>: partidas ganadas · <strong>PP</strong>: partidas perdidas ·{' '}
        <strong>CE</strong>: coeficiente de efectividad · <strong>Tantos</strong>: tantos acumulados (cap {tournament.target_points})
      </div>
    </div>
  );
}
