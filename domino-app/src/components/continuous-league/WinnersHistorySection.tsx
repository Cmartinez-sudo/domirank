import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { ContinuousLeagueWinnerHistoryRow } from "@/types/continuous-league";

type Props = {
  tournamentId: string;
  winners:      ContinuousLeagueWinnerHistoryRow[];
  /** Preservar ?season=N en links. */
  seasonParam?: number | null;
};

/** Parsea YYYY-MM-DD a Date "midnight UTC" para que toLocaleDateString
 *  con timeZone:"UTC" devuelva el día exacto sin drift de TZ del browser. */
function toDateUTC(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatShortSpanish(yyyymmdd: string): string {
  return toDateUTC(yyyymmdd).toLocaleDateString("es", {
    weekday:  "short",
    day:      "2-digit",
    month:    "short",
    timeZone: "UTC",
  });
}

function buildHref(
  tournamentId: string,
  day:          string,
  season:       number | null | undefined,
): string {
  const params = new URLSearchParams();
  params.set("day", day);
  if (season != null) params.set("season", String(season));
  return `/tournaments/${tournamentId}?${params.toString()}`;
}

/**
 * F2.5 — Historial cronológico de ganadores del día.
 *
 * Una fila por session_day: avatar + "Día Mes → 👑 Nombre (pts, partidas)".
 * Tap navega al día correspondiente (preserva ?season).
 *
 * Renderiza null si winners está vacío — una polla sin partidas confirmadas
 * no necesita esta sección.
 *
 * Mostramos máximo 10 filas. Si hay más, agregamos un botón "Ver todo el
 * histórico →" disabled (la página /winners llegará en v2).
 */
export function WinnersHistorySection({
  tournamentId, winners, seasonParam = null,
}: Props) {
  if (winners.length === 0) return null;

  const visible = winners.slice(0, 10);
  const hasMore = winners.length > 10;

  return (
    <section className="card p-0 overflow-hidden">
      <h2 className="px-4 py-3 border-b border-border font-semibold text-sm">
        Historial de ganadores
      </h2>
      <ul className="divide-y divide-border/40">
        {visible.map((w) => {
          const name = w.winner_display_name ?? w.winner_username;
          return (
            <li key={w.session_day}>
              <Link
                href={buildHref(tournamentId, w.session_day, seasonParam)}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-2/60 transition text-sm"
              >
                <span className="capitalize text-text-mute shrink-0 min-w-[88px]">
                  {formatShortSpanish(w.session_day)}
                </span>
                <span className="text-text-mute shrink-0" aria-hidden="true">→</span>
                <span aria-hidden="true" className="shrink-0">👑</span>
                <Avatar
                  player={{
                    username:     w.winner_username,
                    display_name: w.winner_display_name,
                    avatar_url:   w.winner_avatar_url,
                  }}
                  size={24}
                />
                <span className="font-medium truncate">{name}</span>
                <span className="text-text-mute text-xs shrink-0 ml-auto">
                  {w.total_points} pts · {w.matches_played} {w.matches_played === 1 ? "partida" : "partidas"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <div className="px-4 py-2.5 border-t border-border/40 flex justify-end">
          <button
            type="button"
            disabled
            title="Próximamente — v2"
            className="text-xs text-text-mute hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ver todo el histórico →
          </button>
        </div>
      )}
    </section>
  );
}
