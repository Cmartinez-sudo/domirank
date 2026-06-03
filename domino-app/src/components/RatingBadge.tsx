import { toDisplayRating, tierFor, DEFAULT_ELO, NR_THRESHOLD } from "@/lib/rating";

type Props = {
  /** Valor display 1-20. Si null/undefined, calcula desde elo. */
  display?: number | null;
  /** Alternativa: pasar Elo y se computa el display. */
  elo?: number | null;
  /** Total games. Si < NR_THRESHOLD (5), renderiza "NR" en lugar del número. */
  games?: number | null;
  /** Compact = solo el número. Default = "DR 8.5". */
  compact?: boolean;
  size?: "xs" | "sm" | "md";
};

/**
 * Pill visual del DomiRank display (1-20) con color del tier.
 * Resilient: acepta display o elo y resuelve internamente.
 *
 * NR state (games < NR_THRESHOLD): renderiza pill "NR" ámbar — el rating
 * todavía no es confiable y mostrar un número faux daría señal falsa.
 */
export function RatingBadge({
  display,
  elo,
  games,
  compact = false,
  size = "sm",
}: Props) {
  const sizeClass =
    size === "xs" ? "text-[10px] px-1.5 py-0" :
    size === "md" ? "text-sm px-2.5 py-1" :
    "text-xs px-2 py-0.5";

  // NR — el rating todavía no es confiable. Mostramos pill "NR" ámbar.
  if ((games ?? 0) < NR_THRESHOLD) {
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-full ${sizeClass} bg-amber-400/15 text-amber-400 border border-amber-400/30`}
        title={`Sin rating: faltan ${Math.max(0, NR_THRESHOLD - (games ?? 0))} partidas para calibrar`}
      >
        NR
      </span>
    );
  }

  let d: number | null = null;
  if (typeof display === "number") d = display;
  else if (typeof elo === "number") d = toDisplayRating(elo);

  // Sin datos suficientes → marca neutra
  if (d == null) {
    return (
      <span className={`inline-flex items-center font-semibold rounded-full px-2 py-0.5 text-xs bg-surface-3 text-text-mute`}>
        —
      </span>
    );
  }

  const tier = tierFor(d);

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${sizeClass}`}
      style={{
        background: `${tier.color}22`,
        color: tier.color,
        border: `1px solid ${tier.color}44`,
      }}
      title={tier.name}
    >
      {compact ? "" : <span className="opacity-70 mr-1">DR</span>}
      <span className="font-mono tabular-nums">{d.toFixed(1)}</span>
    </span>
  );
}

/**
 * Wrapper que toma un objeto de tipo SearchedUser / profile_ratings row.
 * Resuelve automáticamente el bucket global. Útil para listas.
 */
export function RatingBadgeForUser({
  user,
  compact,
  size,
}: {
  user: {
    global_display?: number | null;
    global_elo?: number | null;
    total_games?: number | null;
  };
  compact?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  return (
    <RatingBadge
      display={user.global_display ?? null}
      elo={user.global_elo ?? DEFAULT_ELO}
      games={user.total_games ?? 0}
      compact={compact}
      size={size}
    />
  );
}
