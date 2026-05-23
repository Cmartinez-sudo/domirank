import { updateRatings, type TeamInput, type PlayerRatingUpdate } from "./rating";
import { ratingCol } from "./rating-buckets";
import type { SetCode, FormatCode } from "./modalidades";

/**
 * Pure rating-computation pipeline shared by `applyMatchRating` (live attest
 * flow) and the cron `auto-confirm` orphan recovery. Extracted to be testable
 * in isolation and to keep the two callers from drifting apart.
 *
 * Inputs are the rows you'd typically fetch from `match_players`, `match_rounds`
 * and `profiles`. Output is the payload ready to send to the SQL RPC
 * `apply_match_rating` plus the `teamInputs` used (useful for logging/audit).
 */

export type MatchPlayerRow = {
  user_id: string;
  team: number;
};

export type MatchRoundRow = {
  team: number;
  points: number;
};

export type ProfileRatingRow = {
  id: string;
  [bucketCol: string]: string | number;
};

export type RatingPayloadItem = {
  user_id: string;
  rank: 1 | 2;
  elo_before: number;
  elo_after: number;
  k_used: number;
};

export type ComputeResult =
  | { ok: true; payload: RatingPayloadItem[]; teamInputs: TeamInput[]; updates: PlayerRatingUpdate[] }
  | { ok: false; error: "no_players" | "missing_profile" };

export function computeRatingPayload(args: {
  format: FormatCode;
  setSize: SetCode;
  matchPlayers: MatchPlayerRow[];
  matchRounds: MatchRoundRow[];
  profiles: ProfileRatingRow[];
}): ComputeResult {
  const { format, setSize, matchPlayers, matchRounds, profiles } = args;

  if (matchPlayers.length === 0) return { ok: false, error: "no_players" };

  const eloCol   = ratingCol(setSize, format, "elo");
  const gamesCol = ratingCol(setSize, format, "games");

  // 1) Aggregate team scores from match_rounds (source of truth, not the
  //    denormalized match_players.score which RLS may have blocked).
  const teamScores: Record<number, number> = {};
  for (const r of matchRounds) {
    teamScores[r.team] = (teamScores[r.team] ?? 0) + r.points;
  }
  // Ensure every team present in match_players has an entry (even 0).
  for (const mp of matchPlayers) {
    if (teamScores[mp.team] === undefined) teamScores[mp.team] = 0;
  }

  // 2) Index profiles for O(1) lookup.
  const profileById = new Map<string, ProfileRatingRow>();
  for (const p of profiles) profileById.set(p.id, p);

  // 3) Group players by team, then build TeamInput[] sorted by team number.
  const teamsMap = new Map<number, MatchPlayerRow[]>();
  for (const mp of matchPlayers) {
    if (!teamsMap.has(mp.team)) teamsMap.set(mp.team, []);
    teamsMap.get(mp.team)!.push(mp);
  }

  const teamInputs: TeamInput[] = [];
  for (const [team, rows] of Array.from(teamsMap.entries()).sort(([a], [b]) => a - b)) {
    const score = teamScores[team] ?? 0;
    // Rank = 1 + count of teams with strictly higher score. Ties share rank.
    const rank = 1 + Object.values(teamScores).filter((s) => s > score).length;
    const players = [];
    for (const row of rows) {
      const profile = profileById.get(row.user_id);
      if (!profile) return { ok: false, error: "missing_profile" };
      players.push({
        user_id:      row.user_id,
        elo:          Number(profile[eloCol]),
        games_played: Number(profile[gamesCol]),
      });
    }
    teamInputs.push({ team, rank: rank as 1 | 2, score, players });
  }

  // 4) Run the Elo engine.
  const updates = updateRatings(teamInputs);

  // 5) Map to the SQL RPC payload shape.
  const payload: RatingPayloadItem[] = updates.map((u) => {
    const team = teamInputs.find((t) => t.players.some((p) => p.user_id === u.user_id))!;
    return {
      user_id:    u.user_id,
      rank:       team.rank,
      elo_before: u.elo_before,
      elo_after:  u.elo_after,
      k_used:     u.k_used,
    };
  });

  return { ok: true, payload, teamInputs, updates };
}
