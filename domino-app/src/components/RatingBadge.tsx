import { toDisplayRating, tierFor, DEFAULT_MU, DEFAULT_SIGMA } from "@/lib/rating";

type Props = {
  /** Valor display 1-20. Si null/undefined, calcula desde ordinal (μ-3σ). */
  display?: number | null;
  /** Alternativa: pasar ordinal directo (μ-3σ). */
  ordinal?: number | null;
  /** Alternativa: pasar μ/σ y se computa el display. */
  mu?: number | null;
  sigma?: number | null;
  /** Si total_games < 5, marca como "provisional" con opacidad reducida. */
  games?: number | null;
  /** Compact = solo el número. Default = "DR 8.5". */
  compact?: boolean;
  size?: "xs" | "sm" | "md";
};

/**
 * Pill visual del DomiRank display (1-20) con color del tier.
 * Resilient: acepta display, ordinal, o μ/σ y resuelve internamente.
 */
export function RatingBadge({
  display,
  ordinal,
  mu,
  sigma,
  games,
  compact = false,
  size = "sm",
}: Props) {
  let d: number | null = null;
  if (typeof display === "number") d = display;
  else if (typeof ordinal === "number") d = toDisplayRating(ordinal);
  else if (typeof mu === "number" && typeof sigma === "number") d = toDisplayRating(mu - 3 * sigma);

  // Sin datos suficientes → marca neutra
  if (d == null) {
    return (
      <span className={`inline-flex items-center font-semibold rounded-full px-2 py-0.5 text-xs bg-surface-3 text-text-mute`}>
        —
      </span>
    );
  }

  const tier = tierFor(d);
  const provisional = (games ?? 0) < 5;

  const sizeClass =
    size === "xs" ? "text-[10px] px-1.5 py-0" :
    size === "md" ? "text-sm px-2.5 py-1" :
    "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${sizeClass} ${provisional ? "opacity-70" : ""}`}
      style={{
        background: `${tier.color}22`,
        color: tier.color,
        border: `1px solid ${tier.color}44`,
      }}
      title={provisional ? "Rating provisional (menos de 5 partidas)" : tier.name}
    >
      {compact ? "" : <span className="opacity-70 mr-1">DR</span>}
      <span className="font-mono tabular-nums">{d.toFixed(1)}</span>
      {provisional && <span className="ml-1 opacity-60">·</span>}
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
    global_ordinal?: number | null;
    singles_mu?: number | null;
    singles_sigma?: number | null;
    total_games?: number | null;
  };
  compact?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  return (
    <RatingBadge
      display={user.global_display ?? null}
      ordinal={user.global_ordinal ?? null}
      mu={user.singles_mu ?? DEFAULT_MU}
      sigma={user.singles_sigma ?? DEFAULT_SIGMA}
      games={user.total_games ?? 0}
      compact={compact}
      size={size}
    />
  );
}
