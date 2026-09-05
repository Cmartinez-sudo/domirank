import type { ContinuousLeagueDailyStandingsRow } from "@/types/continuous-league";
import { DayWinnerBadge } from "./DayWinnerBadge";

type Props = {
  rows:          ContinuousLeagueDailyStandingsRow[];
  currentUserId: string;
};

/**
 * Tabla del día (5am session_day cutoff). Shape simple: V/D/%/Racha + corona
 * "Rey del día" para el ganador (badge inline; confeti se dispara desde
 * ContinuousLeagueHomePage cuando el viewer mismo es el winner).
 */
export function DailyLeaderboard({ rows, currentUserId }: Props) {
  const hasGames = rows.some((r) => r.games_played > 0);
  const today = new Date().toLocaleDateString("es", {
    weekday: "long",
    day:     "2-digit",
    month:   "long",
  });

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="font-semibold">Tabla · Hoy</div>
      </div>

      <div className="flex items-center justify-between bg-bg-2 rounded-lg px-3 py-2 mb-3 text-sm">
        <div>
          <div className="text-text-mute text-[10px] uppercase tracking-wider">Hoy</div>
          <div className="font-medium capitalize">{today}</div>
        </div>
      </div>

      {hasGames ? (
        <DailyStandingsTable rows={rows} currentUserId={currentUserId} />
      ) : (
        <div className="py-6 text-center text-text-dim text-sm">
          Aún no se han jugado partidas hoy. Inicia una para empezar la tabla del día.
        </div>
      )}
    </div>
  );
}

function DailyStandingsTable({ rows, currentUserId }: { rows: ContinuousLeagueDailyStandingsRow[]; currentUserId: string }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm" role="table" aria-label="Tabla del día">
        <thead>
          <tr className="text-text-mute text-[11px] uppercase tracking-wider">
            <th className="text-left py-2 pl-2 font-medium">#</th>
            <th className="text-left font-medium">Jugador</th>
            <th className="text-right font-medium">Pts</th>
            <th className="text-right font-medium">V</th>
            <th className="text-right font-medium">D</th>
            <th className="text-right font-medium">%</th>
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

            // current_streak viene del SQL ya formateado: "3W", "1L" o "—".
            // Coloreamos chip W primary / L danger; "—" sin chip.
            const streakLast = r.current_streak.slice(-1);
            const streakIsW  = streakLast === "W";
            const streakIsL  = streakLast === "L";

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
                <td data-testid="player-name" className="font-medium truncate max-w-[140px]">
                  {r.is_day_winner && <DayWinnerBadge variant="compact" />}
                  {r.display_name ?? r.username}
                </td>
                <td className="text-right font-bold tabular-nums">{r.total_points}</td>
                <td className="text-right font-bold text-primary tabular-nums">{r.wins}</td>
                <td className="text-right text-text-dim tabular-nums">{r.losses}</td>
                <td className="text-right tabular-nums">{r.games_played ? `${r.win_pct}%` : "—"}</td>
                <td className="text-right pr-2">
                  {streakIsW || streakIsL ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                      streakIsW ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"
                    }`}>
                      {r.current_streak}
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
