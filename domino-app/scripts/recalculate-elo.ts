/**
 * Recalculate all Elo ratings from scratch.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/recalculate-elo.ts
 *
 * What it does:
 *   1. Calls reset_all_elo() SQL function to clear all Elo state.
 *   2. Reads all confirmed matches ordered by confirmed_at ASC.
 *   3. For each match: loads players, reads current Elo per bucket,
 *      computes Elo update via updateRatings(), calls apply_match_rating RPC.
 *   4. Logs progress every 10 matches and a summary at the end.
 *
 * This script is the authoritative replay engine. The SQL function reset_all_elo()
 * is a destructive preparation step — ONLY run in dev or during a planned
 * maintenance window in production.
 */

import { createClient } from "@supabase/supabase-js";
import { updateRatings, type TeamInput } from "../src/lib/rating";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Maps (set_size, format) to profile Elo column name. */
function eloCol(setSize: string, format: string): string {
  if (format === "singles" && setSize === "d9") return "d9_singles_elo";
  if (format === "doubles" && setSize === "d9") return "d9_doubles_elo";
  if (format === "doubles") return "doubles_elo";
  return "singles_elo";
}

/** Maps (set_size, format) to profile games column name. */
function gamesCol(setSize: string, format: string): string {
  if (format === "singles" && setSize === "d9") return "d9_singles_games";
  if (format === "doubles" && setSize === "d9") return "d9_doubles_games";
  if (format === "doubles") return "doubles_games";
  return "singles_games";
}

async function main() {
  console.log("=== DomiRank Elo Recalculator ===\n");

  // Step 1: Reset all Elo state
  console.log("Step 1: Resetting all Elo values...");
  const { error: resetErr } = await supabase.rpc("reset_all_elo");
  if (resetErr) {
    console.error("reset_all_elo failed:", resetErr.message);
    process.exit(1);
  }
  console.log("  Reset complete.\n");

  // Step 2: Load all confirmed matches in order
  console.log("Step 2: Loading confirmed matches...");
  const { data: matches, error: matchesErr } = await supabase
    .from("matches")
    .select("id, format, set_size, confirmed_at")
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: true });

  if (matchesErr || !matches) {
    console.error("Failed to load matches:", matchesErr?.message);
    process.exit(1);
  }
  console.log(`  Found ${matches.length} confirmed matches.\n`);

  // Step 3: Replay each match
  let processed = 0;
  let failed = 0;

  for (const match of matches) {
    try {
      const ok = await replayMatch(match.id, match.format, match.set_size ?? "d6");
      if (ok) {
        processed++;
      } else {
        failed++;
        console.warn(`  [WARN] Skipped match ${match.id}`);
      }
    } catch (e) {
      failed++;
      console.error(`  [ERROR] Match ${match.id}:`, e);
    }

    if ((processed + failed) % 10 === 0) {
      console.log(`  Progress: ${processed + failed}/${matches.length} (${failed} failed)`);
    }
  }

  console.log(`\n=== Recalculation complete ===`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Total:     ${matches.length}`);
}

async function replayMatch(matchId: string, format: string, setSize: string): Promise<boolean> {
  const ec = eloCol(setSize, format);
  const gc = gamesCol(setSize, format);

  // Load players in this match
  const { data: mps } = await supabase
    .from("match_players")
    .select("user_id, team")
    .eq("match_id", matchId);
  if (!mps || mps.length === 0) return false;

  // Compute team scores from match_rounds
  const { data: rounds } = await supabase
    .from("match_rounds")
    .select("team, points")
    .eq("match_id", matchId);
  const teamScores: Record<number, number> = {};
  for (const r of rounds ?? []) {
    teamScores[r.team] = (teamScores[r.team] ?? 0) + r.points;
  }
  for (const mp of mps) {
    if (teamScores[mp.team] === undefined) teamScores[mp.team] = 0;
  }

  // Load current Elo + games from profiles
  const userIds = mps.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select(`id, ${ec}, ${gc}`)
    .in("id", userIds);
  if (!profiles) return false;
  const byId = new Map(profiles.map((p: any) => [p.id, p]));

  // Build team inputs
  const teamsMap = new Map<number, typeof mps>();
  for (const r of mps) {
    if (!teamsMap.has(r.team)) teamsMap.set(r.team, []);
    teamsMap.get(r.team)!.push(r);
  }

  const teamInputs: TeamInput[] = Array.from(teamsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([team, rows]) => {
      const rank = 1 + Object.values(teamScores).filter((s) => s > teamScores[team]).length;
      return {
        team,
        rank: rank as 1 | 2,
        score: teamScores[team] ?? 0,
        players: rows.map((r) => {
          const p: any = byId.get(r.user_id);
          return {
            user_id:      r.user_id,
            elo:          Number(p[ec]),
            games_played: Number(p[gc]),
          };
        }),
      };
    });

  const updates = updateRatings(teamInputs);

  const { error } = await supabase.rpc("apply_match_rating", {
    p_match_id: matchId,
    p_updates: updates.map((u) => ({
      user_id:    u.user_id,
      rank:       teamInputs.find((t) => t.players.some((p) => p.user_id === u.user_id))!.rank,
      elo_before: u.elo_before,
      elo_after:  u.elo_after,
      k_used:     u.k_used,
    })),
  });

  if (error) {
    console.error(`  apply_match_rating failed for ${matchId}:`, error.message);
    return false;
  }
  return true;
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});
