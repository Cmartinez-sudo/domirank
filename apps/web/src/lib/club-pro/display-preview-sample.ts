/**
 * Sample tournament data for the display layout editor preview.
 *
 * Frozen fixture so the admin sees a realistic-looking display while
 * editing, without hitting the DB or seeing whatever real-world
 * tournament happens to be in-flight. The shapes match what the live
 * `DisplayClient` fetches from Supabase, so `DisplayShell` renders
 * this the same way it would render production data.
 *
 * Uses:
 *   - 8 pairs (typical small tournament)
 *   - 3 rounds (round 3 in progress)
 *   - Round 1 + 2 fully finished with realistic scores
 *   - Round 3 has some in-progress matches
 *   - 2 sample sponsors (matching the default slotsCount=2)
 *
 * The sponsor logo URLs point to `/branding/logo-icon.svg` so the
 * preview renders inline without external network hits and keeps
 * working in offline dev.
 */

import type {
  DisplayShellMatch,
  DisplayShellPair,
  DisplayShellRound,
  DisplayShellSponsor,
  DisplayShellTournament,
} from '@/app/t/[slug]/DisplayShell';

export const SAMPLE_TOURNAMENT: DisplayShellTournament = {
  id: 'sample-tournament',
  name: 'Torneo Ejemplo',
  status: 'in_progress',
  format: 'swiss_pairs',
  current_round_number: 3,
  rounds_count: 5,
  round_duration_minutes: 45,
  target_points: 200,
  organization_name: 'Club Ejemplo',
  organization_logo_url: null,
  brand_primary_color: '#2563eb',
};

export const SAMPLE_PAIRS: DisplayShellPair[] = [
  { id: 'p1', player_a_name: 'Pedro Ramírez', player_b_name: 'María López', initial_seed: 1, withdrawn_at: null },
  { id: 'p2', player_a_name: 'Juan Torres', player_b_name: 'Ana Pérez', initial_seed: 2, withdrawn_at: null },
  { id: 'p3', player_a_name: 'Luis Fernández', player_b_name: 'Carla Ruiz', initial_seed: 3, withdrawn_at: null },
  { id: 'p4', player_a_name: 'Miguel Salazar', player_b_name: 'Rosa Vega', initial_seed: 4, withdrawn_at: null },
  { id: 'p5', player_a_name: 'Diego Castro', player_b_name: 'Sofía Herrera', initial_seed: 5, withdrawn_at: null },
  { id: 'p6', player_a_name: 'Ricardo Mora', player_b_name: 'Elena Silva', initial_seed: 6, withdrawn_at: null },
  { id: 'p7', player_a_name: 'Andrés Rojas', player_b_name: 'Paula Díaz', initial_seed: 7, withdrawn_at: null },
  { id: 'p8', player_a_name: 'Tomás Cruz', player_b_name: 'Laura Ortiz', initial_seed: 8, withdrawn_at: null },
];

export const SAMPLE_ROUNDS: DisplayShellRound[] = [
  { id: 'r1', round_number: 1, started_at: '2026-01-01T18:00:00Z', ended_at: '2026-01-01T18:45:00Z' },
  { id: 'r2', round_number: 2, started_at: '2026-01-01T19:00:00Z', ended_at: '2026-01-01T19:45:00Z' },
  // Round 3 started 10 minutes ago so the timer shows a live count-down.
  { id: 'r3', round_number: 3, started_at: new Date(Date.now() - 10 * 60_000).toISOString(), ended_at: null },
];

export const SAMPLE_MATCHES: DisplayShellMatch[] = [
  // Round 1 — all finished with realistic domino scores.
  { id: 'm1', round_id: 'r1', table_number: 1, pair_home_id: 'p1', pair_away_id: 'p8', pair_home_score: 200, pair_away_score: 145, status: 'finished', round_number: 1 },
  { id: 'm2', round_id: 'r1', table_number: 2, pair_home_id: 'p2', pair_away_id: 'p7', pair_home_score: 168, pair_away_score: 200, status: 'finished', round_number: 1 },
  { id: 'm3', round_id: 'r1', table_number: 3, pair_home_id: 'p3', pair_away_id: 'p6', pair_home_score: 200, pair_away_score: 182, status: 'finished', round_number: 1 },
  { id: 'm4', round_id: 'r1', table_number: 4, pair_home_id: 'p4', pair_away_id: 'p5', pair_home_score: 176, pair_away_score: 200, status: 'finished', round_number: 1 },
  // Round 2 — finished.
  { id: 'm5', round_id: 'r2', table_number: 1, pair_home_id: 'p1', pair_away_id: 'p7', pair_home_score: 200, pair_away_score: 155, status: 'finished', round_number: 2 },
  { id: 'm6', round_id: 'r2', table_number: 2, pair_home_id: 'p3', pair_away_id: 'p5', pair_home_score: 189, pair_away_score: 200, status: 'finished', round_number: 2 },
  { id: 'm7', round_id: 'r2', table_number: 3, pair_home_id: 'p4', pair_away_id: 'p8', pair_home_score: 200, pair_away_score: 132, status: 'finished', round_number: 2 },
  { id: 'm8', round_id: 'r2', table_number: 4, pair_home_id: 'p2', pair_away_id: 'p6', pair_home_score: 200, pair_away_score: 174, status: 'finished', round_number: 2 },
  // Round 3 — a mix of in-progress and finished (mirrors real live displays).
  { id: 'm9',  round_id: 'r3', table_number: 1, pair_home_id: 'p1', pair_away_id: 'p5', pair_home_score: 148, pair_away_score: 122, status: 'in_progress', round_number: 3 },
  { id: 'm10', round_id: 'r3', table_number: 2, pair_home_id: 'p4', pair_away_id: 'p3', pair_home_score: 200, pair_away_score: 156, status: 'finished', round_number: 3 },
  { id: 'm11', round_id: 'r3', table_number: 3, pair_home_id: 'p7', pair_away_id: 'p2', pair_home_score: 89,  pair_away_score: 175, status: 'in_progress', round_number: 3 },
  { id: 'm12', round_id: 'r3', table_number: 4, pair_home_id: 'p8', pair_away_id: 'p6', pair_home_score: null, pair_away_score: null, status: 'pending',     round_number: 3 },
];

export const SAMPLE_SPONSORS: DisplayShellSponsor[] = [
  { id: 's1', position: 1, logo_url: '/branding/logo-icon.svg' },
  { id: 's2', position: 2, logo_url: '/branding/logo-icon.svg' },
];
