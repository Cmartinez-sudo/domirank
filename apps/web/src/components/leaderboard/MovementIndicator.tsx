interface MovementIndicatorProps {
  currentRank: number;
  prevRank: number | null;
}

export function MovementIndicator({ currentRank, prevRank }: MovementIndicatorProps) {
  if (prevRank === null) return null;

  const delta = prevRank - currentRank; // positivo = subió

  if (delta > 0) {
    return (
      <span className="text-[10px] font-semibold text-primary leading-none tabular-nums" aria-label={`Subió ${delta} posiciones`}>
        ↑{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="text-[10px] font-semibold text-danger leading-none tabular-nums" aria-label={`Bajó ${Math.abs(delta)} posiciones`}>
        ↓{Math.abs(delta)}
      </span>
    );
  }
  return (
    <span className="text-[10px] text-text-mute leading-none" aria-label="Sin cambio">
      —
    </span>
  );
}
