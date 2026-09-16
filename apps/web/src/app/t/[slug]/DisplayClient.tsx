'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { resolveDisplayConfig } from '@/lib/club-pro/display-config';
import {
  DisplayShell,
  type DisplayShellMatch,
  type DisplayShellPair,
  type DisplayShellRound,
  type DisplayShellSponsor,
} from './DisplayShell';

type TournamentView = {
  id: string;
  name: string;
  display_slug: string;
  status: string;
  format: string;
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
  display_config: unknown;
};

/**
 * Public display client. Owns Supabase fetching + Realtime subscriptions
 * for the live TV view. Renders through the pure `DisplayShell` so the
 * same render tree can be reused by the admin's layout editor preview.
 */
export function DisplayClient({
  slug,
  initialTournament,
}: {
  slug: string;
  initialTournament: TournamentView;
}) {
  const [tournament, setTournament] = useState<TournamentView>(initialTournament);
  const [pairs, setPairs] = useState<DisplayShellPair[]>([]);
  const [matches, setMatches] = useState<DisplayShellMatch[]>([]);
  const [rounds, setRounds] = useState<DisplayShellRound[]>([]);
  const [sponsors, setSponsors] = useState<DisplayShellSponsor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const supabase = supabaseBrowser();

    const [tournamentRes, pairsRes, roundsRes, matchesRes, sponsorsRes] =
      await Promise.all([
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
        supabase
          .from('tournament_sponsors')
          .select('id, position, logo_url')
          .eq('tournament_id', initialTournament.id)
          .order('position', { ascending: true }),
      ]);

    if (tournamentRes.data) setTournament(tournamentRes.data as TournamentView);
    setPairs((pairsRes.data ?? []) as DisplayShellPair[]);
    setRounds((roundsRes.data ?? []) as DisplayShellRound[]);
    setSponsors((sponsorsRes.data ?? []) as DisplayShellSponsor[]);

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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_sponsors', filter: `tournament_id=eq.${initialTournament.id}` },
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

  const config = useMemo(
    () => resolveDisplayConfig(tournament.display_config),
    [tournament.display_config],
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-2xl text-text-mute">Cargando torneo…</div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <DisplayShell
        tournament={tournament}
        pairs={pairs}
        matches={matches}
        rounds={rounds}
        sponsors={sponsors}
        config={config}
      />
    </div>
  );
}
