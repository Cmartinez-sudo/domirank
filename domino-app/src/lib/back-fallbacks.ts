/**
 * Fallbacks de navegación "back" por sección — parents lógicos default.
 *
 * Con el modelo up-nav (ver useSafeBack), la flecha atrás siempre lleva al
 * parent lógico declarado. Estos son los defaults por sección; una page
 * puede pasar un fallbackPath específico (ej. match de torneo → torneo
 * padre, no dashboard).
 *
 * NOTA: profile default es /leaderboard (perfil ajeno viene mayormente de
 * ahí). Para el propio perfil, la page decide `/dashboard` en runtime.
 *
 * Las keys se mantienen en inglés para coherencia con el código.
 * Ver TECH_DEBT.md — inconsistencia spec vs proyecto.
 */
export const BACK_FALLBACKS = {
  profile:            "/leaderboard",
  tournament_detail:  "/tournaments",
  tournament_wizard:  "/tournaments",
  match_detail:       "/dashboard",
  settings_subpage:   "/settings",
} as const;

export type BackFallbackKey = keyof typeof BACK_FALLBACKS;
