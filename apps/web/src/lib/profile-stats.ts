/**
 * Server-side aggregation helpers for the profile page.
 * All functions are pure — they accept raw rows and return computed shapes.
 */

export type MatchStatus = "confirmed" | "pending_attestation" | "disputed" | "void";

export type HistoryRow = {
  rank: number;
  team: number;
  elo_before?: number | null;
  elo_after?: number | null;
  created_at?: string;
  matches: {
    status: MatchStatus;
    match_players: Array<{
      team: number;
      user_id: string;
      score: number;
      profiles: { username: string; display_name: string | null } | null;
    }>;
  } | null;
};

export type EloPoint = {
  elo: number;
  day: string;
  timestamp: number;
};

export type EloRow = { elo_after: number | null; created_at: string };

export type StreakResult = {
  current: { kind: "wins" | "losses" | "none"; count: number };
  best: number;
};

export type PartnerRivalStats = {
  favoritePartner: { userId: string; username: string; name: string; games: number; wins: number; losses: number } | null;
  toughestRival:   { userId: string; username: string; name: string; games: number; my_wins: number; my_losses: number } | null;
};

export type H2HResult = {
  vs:       { games: number; my_wins: number; their_wins: number };
  together: { games: number; wins: number; losses: number };
};

export type EloRange = "last10" | "last50" | "all";

const isConfirmed = (r: HistoryRow) => r.matches?.status === "confirmed";

export function computeStreaks(rows: HistoryRow[]): StreakResult {
  const confirmed = rows.filter(isConfirmed);
  if (confirmed.length === 0) return { current: { kind: "none", count: 0 }, best: 0 };

  const firstWon = confirmed[0].rank === 1;
  const current: StreakResult["current"] = { kind: firstWon ? "wins" : "losses", count: 1 };
  for (let i = 1; i < confirmed.length; i++) {
    const won = confirmed[i].rank === 1;
    if ((current.kind === "wins" && won) || (current.kind === "losses" && !won)) {
      current.count += 1;
    } else {
      break;
    }
  }

  let best = 0;
  let run = 0;
  for (const r of confirmed) {
    if (r.rank === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { current, best };
}

export function aggregateEloSeries(rows: EloRow[], range: EloRange): EloPoint[] {
  const sorted = [...rows]
    .filter((r) => Number.isFinite(Number(r.elo_after)))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (range === "last10") return sorted.slice(-10).map(toPoint);
  if (range === "last50") return sorted.slice(-50).map(toPoint);

  if (sorted.length <= 100) return sorted.map(toPoint);

  const byDay = new Map<string, EloPoint>();
  for (const r of sorted) {
    const d = r.created_at.slice(0, 10);
    byDay.set(d, {
      elo: Number(r.elo_after),
      day: d,
      timestamp: new Date(r.created_at).getTime(),
    });
  }
  return [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function toPoint(r: EloRow): EloPoint {
  return {
    elo: Number(r.elo_after),
    day: r.created_at.slice(0, 10),
    timestamp: new Date(r.created_at).getTime(),
  };
}

export function computePartnerRivalStats(rows: HistoryRow[], myUserId: string): PartnerRivalStats {
  const partnerStats = new Map<string, { userId: string; username: string; name: string; games: number; wins: number; losses: number }>();
  const rivalStats   = new Map<string, { userId: string; username: string; name: string; games: number; my_wins: number; my_losses: number }>();

  for (const r of rows) {
    if (!isConfirmed(r)) continue;
    const myTeam = r.team;
    const won = r.rank === 1;
    const players = r.matches?.match_players ?? [];
    for (const mp of players) {
      if (mp.user_id === myUserId) continue;
      const name = mp.profiles?.display_name?.split(" ")[0] ?? mp.profiles?.username ?? "?";
      const username = mp.profiles?.username ?? mp.user_id;
      if (mp.team === myTeam) {
        const cur = partnerStats.get(mp.user_id) ?? { userId: mp.user_id, username, name, games: 0, wins: 0, losses: 0 };
        cur.games += 1;
        if (won) cur.wins += 1; else cur.losses += 1;
        partnerStats.set(mp.user_id, cur);
      } else {
        const cur = rivalStats.get(mp.user_id) ?? { userId: mp.user_id, username, name, games: 0, my_wins: 0, my_losses: 0 };
        cur.games += 1;
        if (won) cur.my_wins += 1; else cur.my_losses += 1;
        rivalStats.set(mp.user_id, cur);
      }
    }
  }

  const favoritePartner = [...partnerStats.values()]
    .filter((s) => s.games >= 2)
    .sort((a, b) => b.games - a.games || b.wins - a.wins)[0] ?? null;

  const toughestRival = [...rivalStats.values()]
    .filter((s) => s.games >= 2)
    .sort((a, b) => b.my_losses - a.my_losses || b.games - a.games)[0] ?? null;

  return { favoritePartner, toughestRival };
}

export function computeHeadToHead(rows: HistoryRow[], myUserId: string, targetUserId: string): H2HResult {
  let vsGames = 0, myWins = 0, theirWins = 0;
  let togetherGames = 0, togetherWins = 0, togetherLosses = 0;

  for (const r of rows) {
    if (!isConfirmed(r)) continue;
    const players = r.matches?.match_players ?? [];
    const target = players.find((mp) => mp.user_id === targetUserId);
    if (!target) continue;

    const won = r.rank === 1;
    if (target.team === r.team) {
      togetherGames += 1;
      if (won) togetherWins += 1; else togetherLosses += 1;
    } else {
      vsGames += 1;
      if (won) myWins += 1; else theirWins += 1;
    }
  }

  return {
    vs:       { games: vsGames, my_wins: myWins, their_wins: theirWins },
    together: { games: togetherGames, wins: togetherWins, losses: togetherLosses },
  };
}

export type HeatmapCell = { day: string; date: Date; count: number };

export function buildHeatmap(rows: HistoryRow[], now: Date = new Date()): HeatmapCell[] {
  const confirmed = rows.filter(isConfirmed);
  const countsByDay = new Map<string, number>();
  for (const r of confirmed) {
    if (!r.created_at) continue;
    const d = r.created_at.slice(0, 10);
    countsByDay.set(d, (countsByDay.get(d) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = [];
  const endDate = new Date(now);
  endDate.setHours(0, 0, 0, 0);
  for (let i = 83; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ day: key, date: d, count: countsByDay.get(key) ?? 0 });
  }
  return cells;
}

export type FormChip = "W" | "L";

export function buildFormStrip(rows: HistoryRow[], n = 10): FormChip[] {
  return rows
    .filter(isConfirmed)
    .slice(0, n)
    .reverse()
    .map((r) => (r.rank === 1 ? "W" : "L"));
}
