import Link from "next/link";
import type { ContinuousLeagueStandingsRow, ContinuousLeagueDayFilter } from "@/types/continuous-league";

type Props = {
  rows:           ContinuousLeagueStandingsRow[];
  currentUserId:  string;
  /** Si la polla es continua, mostramos tabs Hoy/Histórico. */
  showTabs:       boolean;
  /** Tab activo (cuando showTabs=true). Vacío si !showTabs. */
  activeTab?:     ContinuousLeagueDayFilter;
  /** Tournament id para construir los hrefs de tabs. */
  tournamentId:   string;
  /** Fecha de creación de la polla — para el header histórico. */
  createdAt:      string;
  /** Cantidades para los chips de tabs (today + all). */
  todayCount?:    number;
  allCount?:      number;
  /** Mantener el ?season=N actual al cambiar de tab. */
  seasonParam?:   number | null;
};

function buildHref(tournamentId: string, tab: ContinuousLeagueDayFilter, season: number | null | undefined): string {
  const params = new URLSearchParams();
  if (tab === "today") params.set("day", "today");
  if (season != null) params.set("season", String(season));
  const qs = params.toString();
  return `/tournaments/${tournamentId}${qs ? `?${qs}` : ""}`;
}

export function ContinuousLeagueLeaderboard({
  rows, currentUserId, showTabs, activeTab = "all", tournamentId, createdAt,
  todayCount = 0, allCount = 0, seasonParam = null,
}: Props) {
  const hasGames = rows.some((r) => r.games_played > 0);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="font-semibold">Tabla · Jugadores</div>
      </div>

      {showTabs && (
        <>
          <div className="grid grid-cols-2 gap-1 p-1 bg-bg-2 rounded-xl mb-3" role="tablist">
            <Link
              href={buildHref(tournamentId, "today", seasonParam)}
              scroll={false}
              role="tab"
              aria-selected={activeTab === "today"}
              className={`py-2.5 rounded-lg text-sm font-semibold transition inline-flex items-center justify-center gap-2 min-h-[40px] ${
                activeTab === "today" ? "bg-surface text-text shadow-sm" : "text-text-mute"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Hoy
              <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] bg-surface-3 text-text-dim tabular-nums">
                {todayCount}
              </span>
            </Link>
            <Link
              href={buildHref(tournamentId, "all", seasonParam)}
              scroll={false}
              role="tab"
              aria-selected={activeTab === "all"}
              className={`py-2.5 rounded-lg text-sm font-semibold transition inline-flex items-center justify-center gap-2 min-h-[40px] ${
                activeTab === "all" ? "bg-surface text-text shadow-sm" : "text-text-mute"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3v5h5"/>
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
                <path d="M12 7v5l4 2"/>
              </svg>
              Histórico
              <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] bg-surface-3 text-text-dim tabular-nums">
                {allCount}
              </span>
            </Link>
          </div>
          <DayHeader tab={activeTab} todayCount={todayCount} allCount={allCount} createdAt={createdAt} />
        </>
      )}

      {hasGames ? (
        <StandingsTable rows={rows} currentUserId={currentUserId} />
      ) : (
        <div className="py-6 text-center text-text-dim text-sm">
          {activeTab === "today"
            ? "Aún no se han jugado partidas hoy. Inicia una para empezar la tabla del día."
            : "Aún no hay partidas jugadas en esta polla."}
        </div>
      )}
    </div>
  );
}

function DayHeader({
  tab, todayCount, allCount, createdAt,
}: {
  tab:        ContinuousLeagueDayFilter;
  todayCount: number;
  allCount:   number;
  createdAt:  string;
}) {
  const isToday = tab === "today";
  const label = isToday ? "Tabla del día" : "Tabla histórica";
  let when = "";
  if (isToday) {
    when = new Date().toLocaleDateString("es", { weekday: "long", day: "2-digit", month: "long" });
  } else {
    const since = new Date(createdAt);
    when = `Desde ${since.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  const count = isToday ? todayCount : allCount;
  const plural = count === 1 ? "partida" : "partidas";
  return (
    <div className="flex items-center justify-between bg-bg-2 rounded-lg px-3 py-2 mb-3 text-sm">
      <div>
        <div className="text-text-mute text-[10px] uppercase tracking-wider">{label}</div>
        <div className="font-medium capitalize">{when}</div>
      </div>
      <div className="text-xs px-2 py-1 bg-info/15 text-info rounded-full tabular-nums">
        {count} {plural}
      </div>
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
