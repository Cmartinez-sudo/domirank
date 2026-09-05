import Link from "next/link";

type Props = {
  tournamentId: string;
  currentSeason: number;       // temporada activa de la polla
  viewingSeason: number;       // temporada que el usuario está viendo
};

/**
 * Selector de temporadas. Solo se renderiza si hay >1 temporada histórica.
 * Usa Links con ?season=N — SSR-friendly, sin estado cliente.
 */
export function ContinuousLeagueSeasonSelector({ tournamentId, currentSeason, viewingSeason }: Props) {
  if (currentSeason <= 1) return null;

  const seasons = Array.from({ length: currentSeason }, (_, i) => i + 1);

  return (
    <nav aria-label="Temporadas" className="card p-2 flex items-center gap-1.5 overflow-x-auto">
      <span className="text-text-mute text-xs uppercase tracking-wide px-2 shrink-0">Temporada</span>
      {seasons.map((s) => {
        const isActive = s === viewingSeason;
        const isCurrent = s === currentSeason;
        const href = s === currentSeason
          ? `/tournaments/${tournamentId}`
          : `/tournaments/${tournamentId}?season=${s}`;
        return (
          <Link
            key={s}
            href={href}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors min-h-[36px] inline-flex items-center shrink-0
              ${isActive
                ? "bg-primary text-bg"
                : "text-text-mute hover:bg-surface-2 hover:text-text"
              }`}
          >
            {s}
            {isCurrent && <span className="text-xs opacity-70 ml-1">(actual)</span>}
          </Link>
        );
      })}
    </nav>
  );
}
