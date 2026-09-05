"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";

// ─── Helpers ────────────────────────────────────────────────

/** Canonical pair order: user_a_id must be < user_b_id (CHECK constraint en DB) */
function canonicalPair(a: string, b: string): { user_a_id: string; user_b_id: string } {
  return a < b ? { user_a_id: a, user_b_id: b } : { user_a_id: b, user_b_id: a };
}

/** Verificar que el usuario autenticado es organizador del torneo */
async function assertOrganizer(tournamentId: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado", user: null, supabase };

  const { data: t } = await supabase
    .from("tournaments")
    .select("created_by, status")
    .eq("id", tournamentId)
    .single();

  if (!t) return { ok: false as const, error: "Torneo no encontrado", user: null, supabase };
  if (t.created_by !== user.id)
    return { ok: false as const, error: "Solo el organizador puede realizar esta acción", user: null, supabase };
  if (t.status !== "open")
    return { ok: false as const, error: "El torneo ya no acepta cambios", user: null, supabase };

  return { ok: true as const, error: null, user, supabase };
}

// ─── Server actions ──────────────────────────────────────────

/**
 * Agregar un jugador individual al torneo (solo organizador, torneo en 'open').
 */
export async function addPlayerToTournament(tournamentId: string, userId: string) {
  const auth = await assertOrganizer(tournamentId);
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const { supabase, user } = auth;

  const limit = await checkLimit(rl.tournamentMutation, user.id);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  // Evitar duplicados silenciosamente
  const { error } = await supabase
    .from("tournament_players")
    .upsert({ tournament_id: tournamentId, user_id: userId }, { onConflict: "tournament_id,user_id" });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/manage`);
  return { ok: true as const };
}

/**
 * Agregar una pareja completa al torneo.
 * Crea ambos tournament_players + 1 tournament_pair.
 */
export async function addPairToTournament(tournamentId: string, userA: string, userB: string) {
  if (userA === userB) return { ok: false as const, error: "Los dos jugadores deben ser distintos" };

  const auth = await assertOrganizer(tournamentId);
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const { supabase, user } = auth;

  const limit = await checkLimit(rl.tournamentMutation, user.id);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  // Insertar ambos jugadores
  const playerRows = [
    { tournament_id: tournamentId, user_id: userA },
    { tournament_id: tournamentId, user_id: userB },
  ];

  const { error: pErr } = await supabase
    .from("tournament_players")
    .upsert(playerRows, { onConflict: "tournament_id,user_id" });

  if (pErr) return { ok: false as const, error: pErr.message };

  // Insertar la pareja
  const pair = canonicalPair(userA, userB);
  const { error: prErr } = await supabase.from("tournament_pairs").upsert(
    { tournament_id: tournamentId, ...pair },
    { onConflict: "tournament_id,user_a_id" },
  );

  if (prErr) return { ok: false as const, error: prErr.message };

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/manage`);
  return { ok: true as const };
}

/**
 * Remover un jugador del torneo (y su pareja si tuviera).
 * Solo organizador, solo cuando el torneo está en 'open'.
 */
export async function removeFromTournament(tournamentId: string, userId: string) {
  const auth = await assertOrganizer(tournamentId);
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const { supabase, user } = auth;

  const limit = await checkLimit(rl.tournamentMutation, user.id);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  // Eliminar pair_invites pendientes del jugador en este torneo
  await supabase
    .from("pair_invites")
    .delete()
    .eq("tournament_id", tournamentId)
    .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
    .eq("status", "pending");

  // Eliminar del tournament_pairs (como user_a o user_b)
  await supabase
    .from("tournament_pairs")
    .delete()
    .eq("tournament_id", tournamentId)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  // Eliminar del tournament_players
  const { error } = await supabase
    .from("tournament_players")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/manage`);
  return { ok: true as const };
}

/**
 * Invitar a alguien como partner (el inviter ya está inscripto en el torneo).
 * Crea un pair_invite con status 'pending'.
 */
export async function invitePartner(tournamentId: string, inviteeId: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const limit = await checkLimit(rl.tournamentMutation, user.id);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  if (user.id === inviteeId) return { ok: false as const, error: "No puedes invitarte a ti mismo" };

  // Verificar que el inviter está en el torneo y el torneo está en 'open'
  const { data: t } = await supabase
    .from("tournaments")
    .select("status, inscription_mode")
    .eq("id", tournamentId)
    .single();

  if (!t) return { ok: false as const, error: "Torneo no encontrado" };
  if (t.status !== "open") return { ok: false as const, error: "El torneo ya no acepta invitaciones" };
  if (t.inscription_mode !== "pre_formed")
    return { ok: false as const, error: "Este torneo no acepta invitaciones de pareja" };

  const { data: inviterPlayer } = await supabase
    .from("tournament_players")
    .select("user_id")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .single();

  if (!inviterPlayer) return { ok: false as const, error: "No estás inscrito en este torneo" };

  // Verificar que el inviter no tiene pareja ya asignada
  const { data: existingPair } = await supabase
    .from("tournament_pairs")
    .select("id")
    .eq("tournament_id", tournamentId)
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .maybeSingle();

  if (existingPair) return { ok: false as const, error: "Ya tienes un partner asignado" };

  // Insertar la invitación
  const { error } = await supabase.from("pair_invites").upsert(
    {
      tournament_id: tournamentId,
      inviter_id: user.id,
      invitee_id: inviteeId,
      status: "pending",
    },
    { onConflict: "tournament_id,inviter_id,invitee_id" },
  );

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/manage`);
  return { ok: true as const };
}

/**
 * Aceptar o rechazar una invitación de partner.
 * Solo el invitee puede responder.
 * Al aceptar: delega en la RPC accept_pair_invite (security definer)
 * para bypassear RLS en tournament_players y tournament_pairs.
 */
export async function respondPairInvite(inviteId: string, action: "accept" | "decline") {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const limit = await checkLimit(rl.tournamentMutation, user.id);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  if (action === "decline") {
    // Obtener la invitación para el revalidatePath y validar ownership
    const { data: invite } = await supabase
      .from("pair_invites")
      .select("tournament_id, invitee_id, status")
      .eq("id", inviteId)
      .single();

    if (!invite) return { ok: false as const, error: "Invitación no encontrada" };
    if (invite.invitee_id !== user.id) return { ok: false as const, error: "No tienes permiso para responder esta invitación" };
    if (invite.status !== "pending") return { ok: false as const, error: "Esta invitación ya fue respondida" };

    // La policy pair_invites_update_invitee permite al invitee hacer el update
    const { error } = await supabase
      .from("pair_invites")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", inviteId);

    if (error) return { ok: false as const, error: error.message };

    revalidatePath(`/tournaments/${invite.tournament_id}`);
    return { ok: true as const };
  }

  // action === 'accept': usar RPC security definer para bypassear RLS
  // en tournament_players y tournament_pairs (el invitee no es organizador).
  const { data: invite } = await supabase
    .from("pair_invites")
    .select("tournament_id")
    .eq("id", inviteId)
    .single();

  const tournamentId = invite?.tournament_id ?? null;

  const { error: rpcErr } = await supabase.rpc("accept_pair_invite", {
    p_invite_id: inviteId,
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? "";
    const friendly =
      msg.includes("invite_not_found_or_not_invitee")
        ? "Invitación no encontrada o no eres el destinatario"
        : msg.includes("inviter_no_longer_in_tournament")
          ? "El invitante ya no está inscrito en el torneo"
          : msg.includes("tournament_not_open")
            ? "El torneo ya no acepta cambios"
            : "No se pudo aceptar la invitación";
    return { ok: false as const, error: friendly };
  }

  if (tournamentId) {
    revalidatePath(`/tournaments/${tournamentId}`);
    revalidatePath(`/tournaments/${tournamentId}/manage`);
  }
  return { ok: true as const };
}

/**
 * Asignar todas las parejas de un torneo de una vez (modo individual_manual).
 * Reemplaza todas las parejas existentes.
 * Solo organizador, solo cuando el torneo está en 'open'.
 */
export async function setTournamentPairs(
  tournamentId: string,
  pairs: Array<{ user_a: string; user_b: string }>,
) {
  const pairsSchema = z.array(
    z.object({ user_a: z.string().uuid(), user_b: z.string().uuid() }),
  );
  const parsed = pairsSchema.safeParse(pairs);
  if (!parsed.success) return { ok: false as const, error: "Datos de parejas inválidos" };

  const auth = await assertOrganizer(tournamentId);
  if (!auth.ok) return { ok: false as const, error: auth.error };
  const { supabase, user } = auth;

  const limit = await checkLimit(rl.tournamentMutation, user.id);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  // Validar que todos los user_a !== user_b
  for (const p of parsed.data) {
    if (p.user_a === p.user_b) return { ok: false as const, error: "Cada pareja debe tener dos jugadores distintos" };
  }

  // Validar que no hay IDs duplicados en el listado completo
  const allIds = parsed.data.flatMap(({ user_a, user_b }) => [user_a, user_b]);
  if (new Set(allIds).size !== allIds.length) {
    return { ok: false as const, error: "Un jugador no puede estar en más de una pareja" };
  }

  // Verificar que todos los jugadores están inscriptos en el torneo
  const { data: players } = await supabase
    .from("tournament_players")
    .select("user_id")
    .eq("tournament_id", tournamentId);

  const enrolledIds = new Set((players ?? []).map((p: { user_id: string }) => p.user_id));
  for (const id of allIds) {
    if (!enrolledIds.has(id)) {
      return { ok: false as const, error: `El jugador ${id} no está inscrito en el torneo` };
    }
  }

  // Eliminar parejas existentes del torneo
  await supabase.from("tournament_pairs").delete().eq("tournament_id", tournamentId);

  // Insertar las nuevas parejas
  const pairRows = parsed.data.map(({ user_a, user_b }) => ({
    tournament_id: tournamentId,
    ...canonicalPair(user_a, user_b),
  }));

  const { error } = await supabase.from("tournament_pairs").insert(pairRows);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}/manage`);
  return { ok: true as const };
}
