"use server";

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Vincula un match recién creado al pairing de torneo correspondiente.
 *
 * Delega en la RPC link_match_to_pairing (security definer) que valida:
 *   1. El pairing existe.
 *   2. El caller (auth.uid()) es uno de los jugadores del pairing.
 *   3. El match pertenece al mismo torneo del pairing.
 *
 * Si el caller no es jugador del pairing, el RPC lanza 'not_a_player_of_this_pairing'
 * y devolvemos el error friendly correspondiente.
 */
export async function linkMatchToPairing(
  pairingId: string,
  matchId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { error } = await supabase.rpc("link_match_to_pairing", {
    p_pairing_id: Number(pairingId),
    p_match_id: matchId,
  });

  if (error) {
    const msg = error.message ?? "";
    const friendly =
      msg.includes("not_a_player_of_this_pairing")
        ? "Esta partida no te corresponde"
        : msg.includes("pairing_not_found")
          ? "El enfrentamiento de torneo no existe"
          : msg.includes("match_not_in_tournament")
            ? "La partida no pertenece a este torneo"
            : "No se pudo vincular la partida al torneo";
    return { ok: false, error: friendly };
  }

  return { ok: true };
}
