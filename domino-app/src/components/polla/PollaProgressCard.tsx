type Props = {
  finishedCount: number;
  targetCount:   number;
  rounds:        number;
};

/**
 * Barra de progreso de una polla cerrada (no `is_open_ended`).
 * targetCount = rounds × combos únicos posibles de pairings.
 */
export function PollaProgressCard({ finishedCount, targetCount, rounds }: Props) {
  if (!targetCount) return null;
  const pct = Math.min(100, Math.round((finishedCount / targetCount) * 100));
  const reached = finishedCount >= targetCount;
  const roundWord = rounds === 1 ? "vuelta" : "vueltas";

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold text-sm">Progreso de la polla</div>
        <div className="text-xs text-text-dim tabular-nums">{pct}%</div>
      </div>
      <div className="h-2.5 bg-bg-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-info transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-text-dim mt-2">
        {finishedCount} de {targetCount} partidas jugadas · {rounds} {roundWord}
        {reached && " — meta alcanzada 🎯"}
      </div>
    </div>
  );
}
