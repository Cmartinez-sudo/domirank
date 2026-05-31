type Props = {
  championName:   string;
  pointsFor:      number;
  wins:           number;
  losses:         number;
};

/**
 * Card del campeón — se muestra arriba de la matches list cuando la polla
 * está en status `finished`. El campeón es el #1 del leaderboard final.
 */
export function ContinuousLeagueChampionCard({ championName, pointsFor, wins, losses }: Props) {
  return (
    <div className="card text-center">
      <div className="text-4xl mb-1">🏆</div>
      <div className="text-text-mute text-xs uppercase tracking-[0.12em]">Campeón</div>
      <div className="text-2xl font-bold mt-2 truncate">{championName}</div>
      <div className="text-text-dim text-sm mt-1">
        {pointsFor} puntos · {wins}V-{losses}D
      </div>
    </div>
  );
}
