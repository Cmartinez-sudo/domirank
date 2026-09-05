/**
 * Pure helpers for HeroNextMatch CTA resolution.
 * Kept in lib/ (no JSX) so Vitest can import without JSX transform issues.
 */

export type PairingForHero = {
  id: string;
  round: number;
  /** Número de mesa asignada a este enfrentamiento. */
  board?: number;
  team_a_user_ids: string[];
  team_b_user_ids: string[];
  match_id: string | null;
  match: { id: string; status: string } | null;
};

export type HeroCta = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export function resolveHeroCta(pairing: PairingForHero, tournamentId: string): HeroCta {
  if (!pairing.match_id || !pairing.match) {
    return {
      label: "Empezar partida",
      href: `/matches/new?tournament=${tournamentId}&pairing=${pairing.id}`,
      variant: "primary",
    };
  }
  if (pairing.match.status === "in_progress") {
    return {
      label: "Continuar partida",
      href: `/matches/${pairing.match.id}/live`,
      variant: "primary",
    };
  }
  if (pairing.match.status === "pending_attestation") {
    return {
      label: "Confirmar resultado",
      href: `/matches/${pairing.match.id}#attest`,
      variant: "secondary",
    };
  }
  return {
    label: "Ver partida",
    href: `/matches/${pairing.match.id}`,
    variant: "secondary",
  };
}
