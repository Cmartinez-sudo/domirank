import Link from "next/link";
import type { ReactNode } from "react";
import type { ContinuousLeagueDayFilter } from "@/types/continuous-league";
import { DateSelector } from "./DateSelector";

type Props = {
  tournamentId:   string;
  activeTab:      ContinuousLeagueDayFilter;
  seasonParam:    number | null;
  todayCount:     number;
  allCount:       number;
  createdAt:      string;
  /** Contenido a renderizar cuando activeTab === "all". */
  globalContent:  ReactNode;
  /** Contenido a renderizar cuando activeTab === "today". */
  todayContent:   ReactNode;
  /** Día seleccionado actualmente (YYYY-MM-DD). Solo se usa cuando activeTab="today". */
  selectedDay?:     string;
  /** session_day "hoy" calculado en server (YYYY-MM-DD). Solo se usa cuando activeTab="today". */
  todaySessionDay?: string;
  /** session_days con partidas confirmadas (DESC). Si está vacío, no se renderiza el DateSelector. */
  availableDays?:   string[];
};

function buildHref(tournamentId: string, tab: ContinuousLeagueDayFilter, season: number | null): string {
  const params = new URLSearchParams();
  if (tab === "today") params.set("day", "today");
  if (season != null) params.set("season", String(season));
  const qs = params.toString();
  return `/tournaments/${tournamentId}${qs ? `?${qs}` : ""}`;
}

/**
 * Orquesta las tabs Global / Hoy del leaderboard de polla continua.
 * Las tabs son `<Link>` (SSR-friendly, mismo patrón que el viejo
 * ContinuousLeagueLeaderboard). El contenido de cada tab lo pasa el padre
 * vía render-prop — así `page.tsx` puede pre-fetchear ambos datasets y
 * cambiar de tab sin re-fetch.
 */
export function LeaderboardTabs({
  tournamentId, activeTab, seasonParam, todayCount, allCount, createdAt,
  globalContent, todayContent,
  selectedDay, todaySessionDay, availableDays,
}: Props) {
  const isToday  = activeTab === "today";
  const count    = isToday ? todayCount : allCount;
  const plural   = count === 1 ? "partida" : "partidas";

  // Día efectivo a mostrar en el header: el seleccionado si vino, si no hoy (browser TZ).
  const headerDate = (() => {
    if (!isToday) return null;
    if (selectedDay) {
      const [y, m, d] = selectedDay.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    }
    return new Date();
  })();

  let when = "";
  if (isToday && headerDate) {
    when = headerDate.toLocaleDateString("es", {
      weekday: "long", day: "2-digit", month: "long",
      timeZone: selectedDay ? "UTC" : undefined,
    });
  } else if (!isToday) {
    const since = new Date(createdAt);
    when = `Desde ${since.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  const label = isToday ? "Tabla del día" : "Tabla global";

  const showDateSelector = isToday
    && selectedDay
    && todaySessionDay
    && availableDays
    && availableDays.length > 0;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-bg-2 rounded-xl" role="tablist">
        <Link
          href={buildHref(tournamentId, "all", seasonParam)}
          scroll={false}
          role="tab"
          aria-selected={!isToday}
          className={`py-2.5 rounded-lg text-sm font-semibold transition inline-flex items-center justify-center gap-2 min-h-[40px] ${
            !isToday ? "bg-surface text-text shadow-sm" : "text-text-mute"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 3v5h5"/>
            <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
            <path d="M12 7v5l4 2"/>
          </svg>
          Global
          <span className="ml-1 inline-block px-1.5 py-0.5 rounded-full text-[10px] bg-surface-3 text-text-dim tabular-nums">
            {allCount}
          </span>
        </Link>
        <Link
          href={buildHref(tournamentId, "today", seasonParam)}
          scroll={false}
          role="tab"
          aria-selected={isToday}
          className={`py-2.5 rounded-lg text-sm font-semibold transition inline-flex items-center justify-center gap-2 min-h-[40px] ${
            isToday ? "bg-surface text-text shadow-sm" : "text-text-mute"
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
      </div>

      {/* DateSelector — solo en tab "Hoy" y solo si hay días con partidas */}
      {showDateSelector && (
        <DateSelector
          tournamentId={tournamentId}
          selectedDay={selectedDay!}
          todaySessionDay={todaySessionDay!}
          availableDays={availableDays!}
          seasonParam={seasonParam}
        />
      )}

      {/* Header con count chip + fecha/rango */}
      <div className="flex items-center justify-between bg-bg-2 rounded-lg px-3 py-2 text-sm">
        <div>
          <div className="text-text-mute text-[10px] uppercase tracking-wider">{label}</div>
          <div className="font-medium capitalize">{when}</div>
        </div>
        <div className="text-xs px-2 py-1 bg-info/15 text-info rounded-full tabular-nums">
          {count} {plural}
        </div>
      </div>

      {/* Contenido del tab activo */}
      {isToday ? todayContent : globalContent}
    </div>
  );
}
