/**
 * Fallbacks de navegación "back" por sección.
 *
 * NOTA: El spec original usa rutas en español (/amigos, /torneos).
 * Las rutas reales del proyecto son /friends y /tournaments.
 * Las keys se mantienen en inglés para coherencia con el código.
 * Ver TECH_DEBT.md — inconsistencia spec vs proyecto.
 */
export const BACK_FALLBACKS = {
  profile:            "/friends",
  tournament_detail:  "/tournaments",
  tournament_wizard:  "/tournaments",
  match_detail:       "/dashboard",
  club_detail:        "/clubs",
  settings_subpage:   "/settings",
} as const;

export type BackFallbackKey = keyof typeof BACK_FALLBACKS;
