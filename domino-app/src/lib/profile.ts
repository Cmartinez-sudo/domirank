/**
 * Profile-level utilities — visibility rules and modality shape.
 * Used by /dashboard and /profile/[username] to keep "what shows" logic
 * in one place.
 */

export type ModalityKey = "d6_singles" | "d6_doubles" | "d9_singles" | "d9_doubles";

export type ModalityRow = {
  key:     ModalityKey;
  title:   string;
  /** "Aún no has jugado partidas …" empty-state copy when owner-view. */
  emptyCopy: string;
  /** Wizard format pre-selection target for the CTA. */
  ctaFormat: "singles" | "doubles";
  /** Wizard set-size pre-selection target for the CTA. */
  ctaSet: "d6" | "d9";
  display: number;
  elo:     number;
  games:   number;
  wins:    number;
  losses:  number;
};

/**
 * Build the 4-modality array from a `profile_ratings` row.
 * Numbers are coerced defensively (the view returns numeric strings via
 * supabase-js sometimes).
 */
export function buildModalities(p: Record<string, unknown>): ModalityRow[] {
  const n = (v: unknown, fallback = 0): number => {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  };

  return [
    {
      key: "d6_singles",
      title: "Singles (6-6)",
      emptyCopy: "Aún no has jugado partidas individuales 6-6. ¡Pruébalo!",
      ctaFormat: "singles", ctaSet: "d6",
      display: n(p.d6_singles_display, 1),
      elo:     n(p.d6_singles_elo, 1500),
      games:   n(p.d6_singles_games),
      wins:    n(p.d6_singles_wins),
      losses:  n(p.d6_singles_losses),
    },
    {
      key: "d6_doubles",
      title: "Parejas (6-6)",
      emptyCopy: "Aún no has jugado en parejas 6-6. ¡Forma equipo!",
      ctaFormat: "doubles", ctaSet: "d6",
      display: n(p.d6_doubles_display, 1),
      elo:     n(p.d6_doubles_elo, 1500),
      games:   n(p.d6_doubles_games),
      wins:    n(p.d6_doubles_wins),
      losses:  n(p.d6_doubles_losses),
    },
    {
      key: "d9_singles",
      title: "Singles (9-9)",
      emptyCopy: "Aún no has jugado partidas individuales 9-9. ¡Pruébalo!",
      ctaFormat: "singles", ctaSet: "d9",
      display: n(p.d9_singles_display, 1),
      elo:     n(p.d9_singles_elo, 1500),
      games:   n(p.d9_singles_games),
      wins:    n(p.d9_singles_wins),
      losses:  n(p.d9_singles_losses),
    },
    {
      key: "d9_doubles",
      title: "Parejas (9-9)",
      emptyCopy: "Aún no has jugado en parejas 9-9. ¡Forma equipo!",
      ctaFormat: "doubles", ctaSet: "d9",
      display: n(p.d9_doubles_display, 1),
      elo:     n(p.d9_doubles_elo, 1500),
      games:   n(p.d9_doubles_games),
      wins:    n(p.d9_doubles_wins),
      losses:  n(p.d9_doubles_losses),
    },
  ];
}

/**
 * Visibility rule for a single modality card.
 *
 * - Owner view (or dashboard): always show. Empty modalities render an
 *   empty-state + CTA to invite the user to play.
 * - Public view (other users' profile): hide modalities with 0 games to
 *   avoid noise. Only relevant data shows.
 */
export function shouldShowModality(games: number, isOwnView: boolean): boolean {
  if (isOwnView) return true;
  return games > 0;
}

/**
 * Filter helper that applies `shouldShowModality` and also collapses 9-9
 * modalities for public view if BOTH 9-9 buckets are empty (avoids
 * dangling header / awkward gaps when the user only plays 6-6).
 */
export function getVisibleModalities(
  modalities: ModalityRow[],
  isOwnView: boolean,
): ModalityRow[] {
  return modalities.filter((m) => shouldShowModality(m.games, isOwnView));
}
