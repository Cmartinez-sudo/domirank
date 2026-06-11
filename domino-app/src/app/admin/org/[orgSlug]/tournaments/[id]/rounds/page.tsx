import { notFound } from 'next/navigation';
import { requireOrgMember } from '@/lib/club-pro/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { MatchScoreCard } from './MatchScoreCard';

export const dynamic = 'force-dynamic';

type PairMini = { id: string; player_a_name: string; player_b_name: string };

type MatchRow = {
  id: string;
  round_id: string;
  table_number: number;
  pair_home_id: string;
  pair_away_id: string | null;
  pair_home_score: number | null;
  pair_away_score: number | null;
  status: string;
  finished_at: string | null;
};

type RoundRow = {
  id: string;
  round_number: number;
  started_at: string | null;
  ended_at: string | null;
};

export default async function RoundsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>;
}) {
  const { orgSlug, id } = await params;
  const { org, role } = await requireOrgMember(orgSlug);
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from('org_tournaments')
    .select('id, status, current_round_number, target_points')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle();
  if (!tournament) notFound();

  const [{ data: roundsRaw }, { data: matchesRaw }, { data: pairsRaw }] =
    await Promise.all([
      supabase
        .from('org_tournament_rounds')
        .select('id, round_number, started_at, ended_at')
        .eq('tournament_id', tournament.id)
        .order('round_number', { ascending: true }),
      supabase
        .from('org_tournament_matches')
        .select(
          'id, round_id, table_number, pair_home_id, pair_away_id, pair_home_score, pair_away_score, status, finished_at',
        )
        .eq('tournament_id', tournament.id)
        .order('table_number', { ascending: true }),
      supabase
        .from('org_tournament_pairs')
        .select('id, player_a_name, player_b_name')
        .eq('tournament_id', tournament.id),
    ]);

  const rounds = (roundsRaw ?? []) as RoundRow[];
  const matches = (matchesRaw ?? []) as MatchRow[];
  const pairs = (pairsRaw ?? []) as PairMini[];
  const pairMap = new Map(pairs.map((p) => [p.id, p]));

  const canWrite = role === 'owner' || role === 'admin';

  if (rounds.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
        No hay rondas todavía. {canWrite && 'Iniciá el torneo desde Resumen.'}
      </div>
    );
  }

  // Show most recent round first.
  const sortedRounds = [...rounds].sort((a, b) => b.round_number - a.round_number);

  return (
    <div className="space-y-8">
      {sortedRounds.map((round) => {
        const roundMatches = matches.filter((m) => m.round_id === round.id);
        const pending = roundMatches.filter((m) =>
          m.status === 'pending' || m.status === 'in_progress',
        ).length;
        return (
          <section key={round.id} className="space-y-3">
            <header className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Ronda {round.round_number}
              </h2>
              <span className="text-xs text-slate-500">
                {pending === 0
                  ? '✓ Cerrada'
                  : `${pending} ${pending === 1 ? 'partida pendiente' : 'partidas pendientes'}`}
              </span>
            </header>
            <ul className="grid gap-3 sm:grid-cols-2">
              {roundMatches.map((m) => {
                const home = pairMap.get(m.pair_home_id);
                const away = m.pair_away_id ? pairMap.get(m.pair_away_id) : null;
                return (
                  <MatchScoreCard
                    key={m.id}
                    orgSlug={orgSlug}
                    matchId={m.id}
                    tableNumber={m.table_number}
                    status={m.status}
                    homeName={home ? `${home.player_a_name} & ${home.player_b_name}` : '?'}
                    awayName={
                      away ? `${away.player_a_name} & ${away.player_b_name}` : null
                    }
                    homeScore={m.pair_home_score}
                    awayScore={m.pair_away_score}
                    targetPoints={tournament.target_points}
                    canWrite={canWrite}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
