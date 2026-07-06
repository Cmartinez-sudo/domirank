"use server";

/**
 * Server actions de attribution para grupos (Fase C+D #3).
 *
 * Decisiones del grilling 2026-06-22 (Fase 3):
 *  #2 importHistoricalMatches: botón explícito (no auto-scan al crear/agregar
 *     miembro). Sin límite temporal — todas las partidas confirmed.
 *  #4 allow_friendlies: el filtro vive en la función SQL attribute_match_to_groups.
 *  #6 Solo matches status='confirmed' son elegibles.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const ImportHistoricalMatchesSchema = z.object({
  groupId: z.string().uuid(),
});

export type ImportResult = {
  scanned: number;
  imported: number;
  skipped: number;
};

/**
 * Importa partidas históricas al grupo (decisión #2 del grilling Fase 3).
 *
 * Algoritmo:
 *  1. Validar caller es admin/co_admin del grupo.
 *  2. Obtener user_ids de miembros activos.
 *  3. Encontrar matches confirmed donde TODOS los jugadores son miembros activos.
 *     - Filtro de amistosas: matches.rated=false solo si group.allow_friendlies=true.
 *  4. Para cada match candidato, llamar attribute_match_to_groups(matchId, 'retroactive').
 *  5. Devolver counts.
 *
 * Idempotente: ON CONFLICT DO NOTHING en group_match_attributions garantiza que
 * re-correr no duplica filas. El delta (skipped) ya representa filas existentes.
 */
export async function importHistoricalMatches(
  input: z.infer<typeof ImportHistoricalMatchesSchema>,
): Promise<ActionResult<ImportResult>> {
  const parsed = ImportHistoricalMatchesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  // Verificar que el caller sea admin/co_admin del grupo.
  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_group_admin", {
    p_user_id: user.id,
    p_group_id: parsed.data.groupId,
  } as never);
  if (adminErr) return { ok: false, error: adminErr.message };
  if (!isAdmin) {
    return { ok: false, error: "No tienes permisos para importar historial en este grupo" };
  }

  // Leer datos del grupo (allow_friendlies, is_active).
  const { data: group } = await supabase
    .from("groups")
    .select("id, is_active, allow_friendlies")
    .eq("id", parsed.data.groupId)
    .maybeSingle();
  if (!group) return { ok: false, error: "Grupo no encontrado" };
  const g = group as { id: string; is_active: boolean; allow_friendlies: boolean };
  if (!g.is_active) return { ok: false, error: "El grupo está desactivado" };

  // Lista de user_ids de miembros activos.
  const { data: members } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", parsed.data.groupId)
    .eq("status", "active");
  const memberIds = (members as Array<{ user_id: string }> | null ?? []).map((m) => m.user_id);
  if (memberIds.length < 4) {
    return { ok: false, error: "El grupo necesita al menos 4 miembros activos para importar partidas" };
  }

  // Encontrar matches confirmed jugados COMPLETAMENTE por miembros del grupo.
  // Query: matches con status=confirmed donde TODOS los match_players.user_id ∈ memberIds.
  // Estrategia: agrupar match_players por match_id, contar filas; comparar con count(*)
  // donde user_id IN (memberIds). Si son iguales, todos los jugadores son miembros.
  const { data: candidateMatches } = await supabase
    .from("match_players")
    .select("match_id, user_id, matches!inner(status, rated)")
    .in("user_id", memberIds)
    .eq("matches.status", "confirmed");

  if (!candidateMatches) return { ok: false, error: "Error consultando partidas" };

  // Agrupar por match_id; un match es candidato si TODOS sus jugadores aparecen
  // en esta lista (es decir, todos son miembros del grupo).
  const matchPlayerCounts = new Map<string, number>();
  const matchRated = new Map<string, boolean>();
  for (const row of candidateMatches as unknown as Array<{
    match_id: string;
    user_id: string;
    matches: { status: string; rated: boolean };
  }>) {
    matchPlayerCounts.set(row.match_id, (matchPlayerCounts.get(row.match_id) ?? 0) + 1);
    matchRated.set(row.match_id, row.matches.rated);
  }

  if (matchPlayerCounts.size === 0) {
    return { ok: true, data: { scanned: 0, imported: 0, skipped: 0 } };
  }

  // Verificar el total de jugadores reales de cada match para filtrar matches
  // donde NO todos los jugadores son miembros del grupo.
  //
  // Defensa contra duplicados (issue #8 del review): si por bug histórico
  // match_players tiene un user_id duplicado para el mismo match, contar
  // raw rows infla el total. Usamos Set<user_id> por match para deduplicar.
  const candidateMatchIds = Array.from(matchPlayerCounts.keys());
  const { data: realCounts } = await supabase
    .from("match_players")
    .select("match_id, user_id")
    .in("match_id", candidateMatchIds);

  const realDistinctMap = new Map<string, Set<string>>();
  for (const row of (realCounts as Array<{ match_id: string; user_id: string }> | null ?? [])) {
    const set = realDistinctMap.get(row.match_id) ?? new Set<string>();
    set.add(row.user_id);
    realDistinctMap.set(row.match_id, set);
  }

  // Matches finales: aquellos donde el subset de members iguala al total real
  // (cuentas distinct para defenderse de duplicados históricos en match_players).
  const fullyOwnedMatchIds = candidateMatchIds.filter((matchId) => {
    const ours = matchPlayerCounts.get(matchId) ?? 0;
    const total = realDistinctMap.get(matchId)?.size ?? 0;
    if (ours !== total) return false;
    // Filtro de amistosas (decisión #4).
    const rated = matchRated.get(matchId) ?? true;
    if (!rated && !g.allow_friendlies) return false;
    return true;
  });

  if (fullyOwnedMatchIds.length === 0) {
    return { ok: true, data: { scanned: 0, imported: 0, skipped: 0 } };
  }

  // Llamar a la función SECURITY DEFINER para cada match. Devuelve cuántas filas
  // se insertaron (0 si ya existía).
  let imported = 0;
  let skipped = 0;
  for (const matchId of fullyOwnedMatchIds) {
    const { data: inserted, error: rpcErr } = await supabase.rpc("attribute_match_to_groups", {
      p_match_id: matchId,
      p_attribution_type: "retroactive",
    } as never);
    if (rpcErr) {
      console.warn(`[importHistoricalMatches] error en match ${matchId}: ${rpcErr.message}`);
      continue;
    }
    if ((inserted as number) > 0) imported += 1;
    else skipped += 1;
  }

  revalidatePath(`/groups/${parsed.data.groupId}`);

  return {
    ok: true,
    data: {
      scanned: fullyOwnedMatchIds.length,
      imported,
      skipped,
    },
  };
}
