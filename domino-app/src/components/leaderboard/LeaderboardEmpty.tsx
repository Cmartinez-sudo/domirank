import Link from "next/link";

interface LeaderboardEmptyProps {
  tournamentId: string;
  isOrganizer: boolean;
}

export function LeaderboardEmpty({ tournamentId, isOrganizer }: LeaderboardEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 px-4 text-center">
      <span className="text-5xl select-none" aria-hidden="true">🎲</span>
      <div>
        <p className="font-semibold text-text">Aún no hay partidas en este torneo</p>
        <p className="text-sm text-text-mute mt-1">Los standings aparecerán cuando se confirme la primera partida.</p>
      </div>
      {isOrganizer && (
        <Link
          href={`/matches/new?tournament=${tournamentId}`}
          className="btn-primary text-sm mt-1"
        >
          + Crear primera partida
        </Link>
      )}
    </div>
  );
}
