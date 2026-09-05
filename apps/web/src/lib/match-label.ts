/**
 * Helper compartido para el "chip de tipo de partida" en historiales,
 * headers en vivo y attestation cards.
 *
 * Contrato UI (Pregunta 8B del refactor):
 *   Chip listado = [ícono count_rule] · {nombre count_rule} · {target_points} pts
 *
 * Los cuatro campos que necesita están en `matches` (y en `tournaments`
 * cuando aplique). Datos históricos con `count_rule=null` se derivan del
 * legacy `modality` vía `countRuleFromLegacyModality`.
 */

import {
  COUNT_RULES,
  countRuleFromLegacyModality,
  type CountRule,
} from "@domirank/shared/matches";

export type MatchLabelInput = {
  count_rule?: CountRule | string | null;
  modality?: string | null;
  target_points?: number | null;
};

export type MatchLabel = {
  countRule: CountRule;
  name: string;
  icon: string;
  /** "Cuenta rival · 200 pts" — versión compacta lista para chip. */
  chip: string;
  /** "Al cerrar la mano, sumas solo las fichas de tus contrincantes." — tooltip. */
  blurb: string;
};

export function matchLabel(m: MatchLabelInput): MatchLabel {
  const rule: CountRule =
    m.count_rule === "rival" || m.count_rule === "mesa"
      ? m.count_rule
      : countRuleFromLegacyModality(m.modality ?? null);
  const info = COUNT_RULES[rule];
  const target = m.target_points ?? null;
  const chip = target != null ? `${info.name} · ${target} pts` : info.name;
  return {
    countRule: rule,
    name: info.name,
    icon: info.icon,
    chip,
    blurb: info.blurb,
  };
}
