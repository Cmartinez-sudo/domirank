/**
 * "👑 Rey del día" badge — visible al lado del nombre del jugador en la
 * fila #1 del DailyLeaderboard cuando `is_day_winner = true`.
 *
 * Variantes:
 *  - `compact` (default): solo la corona inline, sin label. Útil dentro
 *    de tablas con poco espacio.
 *  - `full`: corona + "Rey del día" label. Útil en hero cards.
 */
type Props = {
  variant?: "compact" | "full";
  /** Si `true` (= jugador único del día), muestra label especial. */
  loneWinner?: boolean;
};

export function DayWinnerBadge({ variant = "compact", loneWinner = false }: Props) {
  const label = loneWinner ? "Rey del día (único jugador)" : "Rey del día";
  if (variant === "compact") {
    return (
      <span
        className="text-yellow-400 mr-1"
        aria-label={label}
        title={label}
      >
        👑
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 text-yellow-400 font-bold"
      aria-label={label}
    >
      <span aria-hidden="true">👑</span>
      <span className="text-xs uppercase tracking-wider">{label}</span>
    </span>
  );
}
