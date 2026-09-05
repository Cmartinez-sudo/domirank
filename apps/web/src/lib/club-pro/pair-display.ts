/**
 * Helpers de display para "pairs" que pueden ser parejas (2v2) o jugadores
 * individuales (1v1), dependiendo del format del torneo.
 *
 * Cuando un torneo es 'swiss_individual', `player_b_name` y `player_b_email`
 * son NULL en DB. La UI debe rendear solo `player_a_name` sin "& Partner".
 *
 * Centralizado acá para evitar que cada vista re-implemente el condicional
 * y termine inconsistente.
 */

export type TournamentFormat = 'swiss_pairs' | 'swiss_individual';

export type PairDisplayLike = {
  player_a_name: string;
  player_b_name: string | null;
};

/**
 * Returns the display name for a pair/individual:
 *   - swiss_pairs:      "Pedro & Maria"
 *   - swiss_individual: "Pedro"
 *   - null/missing pair: fallback (default "?")
 *
 * Defensive: also handles the case where player_b_name is null even if the
 * caller forgets to pass format — we just don't render the "&" segment.
 */
export function formatPairName(
  pair: PairDisplayLike | null | undefined,
  fallback = '?',
): string {
  if (!pair) return fallback;
  if (!pair.player_b_name || pair.player_b_name.trim().length === 0) {
    return pair.player_a_name;
  }
  return `${pair.player_a_name} & ${pair.player_b_name}`;
}

export function isIndividualFormat(format: string | null | undefined): boolean {
  return format === 'swiss_individual';
}

/**
 * Labels por format. Útil para headers, badges y prosa.
 * Spanish neutral (no voseo).
 */
export const PAIR_LABELS: Record<
  TournamentFormat,
  {
    /** "pareja" / "jugador" */
    singular: string;
    /** "parejas" / "jugadores" */
    plural: string;
    /** "PAREJA" / "JUGADOR" — para headers de display público */
    upper: string;
    /** "Pareja" / "Jugador" — para títulos */
    titleSingular: string;
    /** "Parejas" / "Jugadores" — para títulos plurales */
    titlePlural: string;
    /** "Parejas (2v2)" / "Individual (1v1)" — badge largo */
    badge: string;
  }
> = {
  swiss_pairs: {
    singular: 'pareja',
    plural: 'parejas',
    upper: 'PAREJA',
    titleSingular: 'Pareja',
    titlePlural: 'Parejas',
    badge: 'Parejas (2v2)',
  },
  swiss_individual: {
    singular: 'jugador',
    plural: 'jugadores',
    upper: 'JUGADOR',
    titleSingular: 'Jugador',
    titlePlural: 'Jugadores',
    badge: 'Individual (1v1)',
  },
};

export function labelsForFormat(format: string | null | undefined) {
  return isIndividualFormat(format)
    ? PAIR_LABELS.swiss_individual
    : PAIR_LABELS.swiss_pairs;
}
