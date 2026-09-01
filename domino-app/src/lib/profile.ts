/**
 * Profile-level utilities — visibility rules and modality shape.
 * Used by /dashboard and /profile/[username] to keep "what shows" logic
 * in one place.
 *
 * Post-Fase-A: solo 2 buckets (d6_doubles, d9_doubles). Singles eliminado.
 */

export type ModalityKey = "d6_doubles" | "d9_doubles";

export type ModalityRow = {
  key:     ModalityKey;
  title:   string;
  /** "Aún no has jugado partidas …" empty-state copy when owner-view. */
  emptyCopy: string;
  /** Wizard set-size pre-selection target for the CTA. */
  ctaSet: "d6" | "d9";
  display: number;
  elo:     number;
  games:   number;
  wins:    number;
  losses:  number;
};

/**
 * Build the modality array from a `profile_ratings` row.
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
      key: "d6_doubles",
      title: "Parejas (6-6)",
      emptyCopy: "Aún no has jugado en parejas 6-6. ¡Forma equipo!",
      ctaSet: "d6",
      display: n(p.d6_doubles_display, 1),
      elo:     n(p.d6_doubles_elo, 1500),
      games:   n(p.d6_doubles_games),
      wins:    n(p.d6_doubles_wins),
      losses:  n(p.d6_doubles_losses),
    },
    {
      key: "d9_doubles",
      title: "Parejas (9-9)",
      emptyCopy: "Aún no has jugado en parejas 9-9. ¡Forma equipo!",
      ctaSet: "d9",
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
 * Hide modalities with 0 games on ALL views (own and public). Users don't
 * want to see a card for a modality they never play — the CTA to explore
 * more modalities lives elsewhere (wizard, discovery), not on the profile.
 */
export function shouldShowModality(games: number, _isOwnView: boolean): boolean {
  return games > 0;
}

export function getVisibleModalities(
  modalities: ModalityRow[],
  isOwnView: boolean,
): ModalityRow[] {
  return modalities.filter((m) => shouldShowModality(m.games, isOwnView));
}
