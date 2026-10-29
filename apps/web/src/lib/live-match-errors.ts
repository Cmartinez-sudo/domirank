/**
 * Mapeo de resultados/errores de la RPC create_live_match (mig 0113) a
 * mensajes en español para el usuario.
 *
 * Vive fuera de live-match.ts porque un archivo "use server" solo puede
 * exportar funciones async (ver PR #91).
 */

/** Jugador que ya está en otra partida activa (in_progress | pending_attestation). */
export type ActiveMatchConflict = {
  user_id: string;
  name: string;
  match_id: string;
  match_status: "in_progress" | "pending_attestation";
  is_self: boolean;
};

/** Payload {ok:false, error:'player_has_active_match', ...} de la RPC. */
export type CreateLiveMatchConflictPayload = {
  ok: false;
  error: "player_has_active_match";
  user_id: string;
  username: string | null;
  display_name: string | null;
  match_id: string;
  match_status: "in_progress" | "pending_attestation";
  is_self: boolean;
};

/** Payload {ok:false, error:'creator_has_active_match', ...} (polla,
 *  p_keep_tournament_matches): el creador tiene una partida de torneo en curso. */
export type CreatorActiveMatchPayload = {
  ok: false;
  error: "creator_has_active_match";
  match_id: string;
  tournament_name: string | null;
  same_tournament: boolean;
};

/** Respuesta jsonb de create_live_match cuando no lanza excepción. */
export type CreateLiveMatchResult =
  | { ok: true; match_id: string; reused: boolean }
  | CreateLiveMatchConflictPayload
  | CreatorActiveMatchPayload;

export function creatorActiveMatchMessage(p: CreatorActiveMatchPayload): string {
  if (p.same_tournament) return "Ya tienes una partida en curso en esta polla. Continúala primero.";
  return `Tienes una partida en curso en "${p.tournament_name ?? "otro torneo"}". Termínala o abandónala primero.`;
}

export function toActiveMatchConflict(p: CreateLiveMatchConflictPayload): ActiveMatchConflict {
  return {
    user_id: p.user_id,
    name: p.display_name || (p.username ? `@${p.username}` : "Un jugador"),
    match_id: p.match_id,
    match_status: p.match_status,
    is_self: p.is_self,
  };
}

export function conflictMessage(c: ActiveMatchConflict): string {
  const pending = c.match_status === "pending_attestation";
  if (c.is_self) {
    return pending
      ? "Tienes una partida pendiente de confirmación. Confírmala o cancélala antes de empezar otra."
      : "Ya estás jugando otra partida. Termínala o cancélala antes de empezar otra.";
  }
  return pending
    ? `${c.name} tiene una partida pendiente de confirmación. Debe confirmarla o cancelarla antes de empezar esta.`
    : `${c.name} ya está jugando otra partida. Debe terminarla o cancelarla antes de empezar esta.`;
}

/** Errores lanzados por la RPC (o por triggers dentro de ella) → español. */
export function describeCreateLiveMatchError(error: { message?: string | null } | null | undefined): string {
  const msg = error?.message ?? "";
  if (msg.includes("not_authenticated")) return "No autenticado.";
  if (msg.includes("creator_not_player")) return "Debes ser uno de los 4 jugadores de la partida.";
  if (msg.includes("duplicate_player")) return "Un jugador no puede estar en dos equipos.";
  if (msg.includes("invalid_teams")) return "Cada equipo debe tener 2 jugadores.";
  if (msg.includes("pairing_not_found")) return "El enfrentamiento de torneo no existe.";
  if (msg.includes("not_a_player_of_this_pairing")) return "Esta partida no te corresponde.";
  if (msg.includes("match_not_in_tournament")) return "El enfrentamiento no corresponde a este torneo.";
  if (msg.includes("pairing_already_has_match")) return "Esta partida ya fue registrada.";
  if (msg.includes("tournament_not_found")) return "Torneo no encontrado.";
  if (msg.includes("not_a_continuous_league")) return "Este torneo no es una polla.";
  if (msg.includes("league_closed")) return "La polla está cerrada.";
  if (msg.includes("player_not_in_league")) return "Hay un jugador que no pertenece a la polla.";
  // Backstop del trigger trg_one_active_match (mig 0059) ante una carrera.
  if (msg.includes("already has an active match")) {
    return "Uno de los jugadores ya está en otra partida activa. Debe terminarla o cancelarla antes de empezar esta.";
  }
  if (msg.includes("matches_one_inprogress_per_user")) {
    return "Ya tienes una partida en curso. Termínala o cancélala antes de empezar otra.";
  }
  return "No se pudo crear la partida. Intenta de nuevo.";
}
