type Tile = { value: string; label: string; hint?: string };

export function StatTiles({
  games, winRate, effectiveness, bestStreak,
}: {
  games: number; winRate: number; effectiveness: number; bestStreak: number;
}) {
  const tiles: Tile[] = [
    { value: String(games), label: "Partidas" },
    { value: `${winRate.toFixed(0)}%`, label: "Win rate" },
    { value: `${effectiveness.toFixed(0)}%`, label: "Efectividad" },
    {
      value: bestStreak > 0 ? `${bestStreak}` : "—",
      label: "Mejor racha",
      hint: bestStreak > 0 ? (bestStreak === 1 ? "victoria" : "victorias") : undefined,
    },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="card py-3 text-center">
          <div className="text-2xl font-mono font-bold tabular-nums">
            {t.value}
            {t.hint && <span className="text-text-mute text-xs font-normal ml-1">{t.hint}</span>}
          </div>
          <div className="text-xs text-text-mute mt-1 uppercase tracking-wide">{t.label}</div>
        </div>
      ))}
    </div>
  );
}
