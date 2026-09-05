/**
 * TournamentFastPath — server component
 *
 * Cuando el usuario llega a /matches/new?tournament=X&pairing=Y,
 * este componente:
 *   1. Lee el torneo (modality, format, points_to_win, time_limit_minutes).
 *   2. Lee el pairing (team_a_user_ids, team_b_user_ids).
 *   3. Llama startLiveMatch con los datos precargados.
 *   4. Vincula el match al pairing via linkMatchToPairing.
 *   5. Redirige a /matches/[id]/live.
 *
 * Si algo falla (pairing no existe, usuario no autorizado, etc.),
 * renderiza un mensaje de error con link de vuelta al torneo.
 *
 * Decisión de diseño: NO hay pantalla de confirmación intermedia.
 * El usuario ya eligió "Empezar partida" desde el hero del torneo.
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { startLiveMatch } from "@/lib/live-match";
import { linkMatchToPairing } from "@/lib/tournament-pairing-link";
import {
  MODALIDADES,
  countRuleFromLegacyModality,
  type CountRule,
  type ModalityCode,
  type SetCode,
} from "@domirank/shared/matches";

// ─── Helpers ────────────────────────────────────────────────

/**
 * Set size del match derivado del torneo. Post refactor count_rule: los
 * torneos nuevos siempre son d6. Torneos legacy con modality='cub' seguían
 * siendo d9 en tiempos previos — con d9 retirado del menú, cualquier torneo
 * nuevo aterriza en d6.
 */
function resolveSetSize(modality: string | null): SetCode {
  // Legacy: 'cub' era doble-9. Cualquier torneo pre-refactor con modality='cub'
  // se conserva como d9 para que sus matches vivan en el bucket histórico.
  if (modality === "cub") return "d9";
  return "d6";
}

/** Capicúa por defecto del torneo. Deriva de MODALIDADES legacy si aplica. */
function resolveCapicua(modality: string | null): number {
  if (!modality) return 30;
  const m = MODALIDADES[modality as ModalityCode];
  return m?.capicua ?? 30;
}

/**
 * Derivación de count_rule para el fast-path: prefiere la columna nueva
 * `tournaments.count_rule`; si es null (torneo legacy pre-migración),
 * cae al mapeo desde `modality`.
 */
function resolveCountRule(t: { count_rule?: string | null; modality?: string | null }): CountRule {
  const raw = t.count_rule;
  if (raw === "rival" || raw === "mesa") return raw;
  return countRuleFromLegacyModality(t.modality);
}

// ─── Error UI ────────────────────────────────────────────────

function FastPathError({
  message,
  tournamentId,
}: {
  message: string;
  tournamentId: string | null;
}) {
  return (
    <div className="max-w-lg mx-auto pt-16 px-4 text-center space-y-4">
      <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">
        {message}
      </div>
      {tournamentId ? (
        <Link
          href={`/tournaments/${tournamentId}`}
          className="btn-ghost inline-block"
        >
          Volver al torneo
        </Link>
      ) : (
        <Link href="/tournaments" className="btn-ghost inline-block">
          Ver torneos
        </Link>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

export async function TournamentFastPath({
  tournamentId,
  pairingId,
}: {
  tournamentId: string;
  pairingId: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <FastPathError
        message="No estás autenticado. Inicia sesión para continuar."
        tournamentId={tournamentId}
      />
    );
  }

  const supabase = await supabaseServer();

  // ── 1. Leer el torneo ──────────────────────────────────────
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, modality, count_rule, format, points_to_win, time_limit_minutes, status")
    .eq("id", tournamentId)
    .single();

  if (!tournament) {
    return (
      <FastPathError
        message="El torneo no existe o no tienes acceso."
        tournamentId={null}
      />
    );
  }

  if (tournament.status !== "in_progress") {
    return (
      <FastPathError
        message="El torneo no está en curso. No se puede iniciar una partida."
        tournamentId={tournamentId}
      />
    );
  }

  // ── 2. Leer el pairing ────────────────────────────────────
  const { data: pairing } = await supabase
    .from("tournament_pairings")
    .select("id, tournament_id, team_a_user_ids, team_b_user_ids, match_id")
    .eq("id", Number(pairingId))
    .single();

  if (!pairing) {
    return (
      <FastPathError
        message="El enfrentamiento de torneo no existe."
        tournamentId={tournamentId}
      />
    );
  }

  // Verificar que el pairing pertenece al torneo correcto
  if (pairing.tournament_id !== tournamentId) {
    return (
      <FastPathError
        message="El enfrentamiento no corresponde a este torneo."
        tournamentId={tournamentId}
      />
    );
  }

  // Verificar que el usuario es jugador del pairing
  const isPlayer =
    (pairing.team_a_user_ids as string[]).includes(user.id) ||
    (pairing.team_b_user_ids as string[]).includes(user.id);

  if (!isPlayer) {
    return (
      <FastPathError
        message="Esta partida no te corresponde. Solo los jugadores del enfrentamiento pueden iniciarla."
        tournamentId={tournamentId}
      />
    );
  }

  // Si ya hay un match vinculado, redirigir directamente
  if (pairing.match_id) {
    // Verificar status del match existente
    const { data: existing } = await supabase
      .from("matches")
      .select("id, status")
      .eq("id", pairing.match_id)
      .single();

    if (existing?.status === "in_progress") {
      redirect(`/matches/${existing.id}/live`);
    }
    // Si el match ya finalizó o está en otra etapa, volver al torneo
    return (
      <FastPathError
        message="Esta partida ya fue registrada."
        tournamentId={tournamentId}
      />
    );
  }

  // ── 3. Determinar parámetros del match desde el torneo ───
  const modality = (tournament.modality ?? null) as string | null;
  const countRule = resolveCountRule(tournament);

  // Post-Fase-A: toda partida es doubles (parejas 2v2).
  const matchFormat = "doubles" as const;

  const setSize = resolveSetSize(modality);
  const targetPoints = (tournament as { points_to_win?: number }).points_to_win ?? 100;
  const capicuaBonus = resolveCapicua(modality);
  const timeLimitMinutes = (tournament as { time_limit_minutes?: number | null }).time_limit_minutes ?? null;

  // ── 4. Crear el match (startLiveMatch) ────────────────────
  const matchRes = await startLiveMatch({
    count_rule: countRule,
    modality: (modality as ModalityCode | null) ?? undefined,
    format: matchFormat,
    set_size: setSize,
    target_points: targetPoints,
    capicua_bonus: capicuaBonus,
    team_a_players: pairing.team_a_user_ids as string[],
    team_b_players: pairing.team_b_user_ids as string[],
    tournament_id: tournamentId,
    time_limit_minutes: timeLimitMinutes,
  });

  if (!matchRes.ok) {
    return (
      <FastPathError
        message={`No se pudo crear la partida: ${matchRes.error}`}
        tournamentId={tournamentId}
      />
    );
  }

  // ── 5. Vincular match al pairing ──────────────────────────
  const linkRes = await linkMatchToPairing(pairingId, matchRes.match_id);
  if (!linkRes.ok) {
    // El match fue creado pero no vinculado. Redirigimos igual (el match es válido).
    // El organizador puede vincularlo manualmente si es necesario.
    console.error("[TournamentFastPath] link_match_to_pairing failed:", linkRes.error);
  }

  // ── 6. Redirigir al scoreboard en vivo ────────────────────
  redirect(`/matches/${matchRes.match_id}/live`);
}
