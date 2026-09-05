import type { ContinuousLeagueStandingsRow } from "@/types/continuous-league";

type Props = {
  rows:          ContinuousLeagueStandingsRow[];
  currentUserId: string;
};

/**
 * Tabla "Global" (histórico) de la polla continua. Shape rico: PF/PC/diff/streak.
 * Las tabs Global/Hoy las maneja ahora `LeaderboardTabs`; este componente solo
 * renderiza la tabla en sí + empty state cuando no hay partidas.
 */
export function ContinuousLeagueLeaderboard({ rows, currentUserId }: Props) {
  const hasGames = rows.some((r) => r.games_played > 0);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="font-semibold">Tabla · Jugadores</div>
      </div>

      {hasGames ? (
        <StandingsTable rows={rows} currentUserId={currentUserId} />
      ) : (
        <div className="py-6 text-center text-text-dim text-sm">
          Aún no hay partidas jugadas en esta polla.
        </div>
      )}
    </div>
  );
}

function StandingsTable({ rows, currentUserId }: { rows: ContinuousLeagueStandingsRow[]; currentUserId: string }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm" role="table" aria-label="Leaderboard de la polla">
        <thead>
          <tr className="text-text-mute text-[11px] uppercase tracking-wider">
            <th className="text-left py-2 pl-2 font-medium">#</th>
            <th className="text-left font-medium">Jugador</th>
            <th className="text-right font-medium">V</th>
            <th className="text-right font-medium">D</th>
            <th className="text-right font-medium">%</th>
            <th className="text-right font-medium">PF</th>
            <th className="text-right font-medium">PC</th>
            <th className="text-right font-medium">±</th>
            <th className="text-right font-medium pr-2">Racha</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((r, i) => {
            const isCurrent = r.user_id === currentUserId;
            const noGames = r.games_played === 0;
            const rank = i + 1;
            const medal = !noGames && (
              rank === 1 ? "bg-amber-400/20 text-amber-300" :
              rank === 2 ? "bg-slate-400/20 text-slate-300" :
              rank === 3 ? "bg-orange-700/30 text-orange-300" : ""
            );
            return (
              <tr
                key={r.user_id}
                data-user-id={r.user_id}
                className={`${isCurrent ? "bg-primary/5" : ""} ${noGames ? "opacity-45" : ""}`}
              >
                <td className="py-2 pl-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${medal || "text-text-mute"}`}>
                    {rank}
                  </span>
                </td>
                <td data-testid="player-name" className="font-medium truncate max-w-[120px]">
                  {r.display_name ?? r.username}
                </td>
                <td className="text-right font-bold text-primary tabular-nums">{r.wins}</td>
                <td className="text-right text-text-dim tabular-nums">{r.losses}</td>
                <td className="text-right tabular-nums">{r.games_played ? `${r.win_pct}%` : "—"}</td>
                <td className="text-right tabular-nums">{r.points_for}</td>
                <td className="text-right text-text-dim tabular-nums">{r.points_against}</td>
                <td
                  className={`text-right tabular-nums ${
                    r.diff > 0 ? "text-primary" : r.diff < 0 ? "text-danger" : "text-text-dim"
                  }`}
                >
                  {r.games_played ? (r.diff > 0 ? `+${r.diff}` : r.diff) : "—"}
                </td>
                <td className="text-right pr-2">
                  {r.current_streak > 0 && r.streak_type ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                      r.streak_type === "W" ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"
                    }`}>
                      {r.current_streak}{r.streak_type}
                    </span>
                  ) : (
                    <span className="text-text-dim">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
