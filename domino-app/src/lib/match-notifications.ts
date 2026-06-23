/**
 * Helpers para enviar emails relacionados a partidas (attestation,
 * confirmación, disputa). Centralizan:
 *   - lectura del meta del match (scores desde match_rounds, labels de equipo)
 *   - lookup de email por user_id (vía get_user_email) — requiere auth context
 *   - lookup bulk vía get_match_player_emails — requiere service role
 *
 * Todos los envíos son fire-and-forget: cualquier error se loguea y se
 * ignora para no romper el flujo principal (firma, finalize, etc.).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

export type MatchEmailMeta = {
  matchId:     string;
  format:      "doubles";
  setSize:     "d6" | "d9";
  scoreTeam1:  number;
  scoreTeam2:  number;
  team1Label:  string;
  team2Label:  string;
  winningTeam: 1 | 2 | null;
};

type AnySupabase = SupabaseClient<any, any, any>;

/**
 * Lee match + players + scores y devuelve la metadata necesaria para los
 * templates. Compatible con cualquier cliente (auth o service).
 * Scores se computan desde match_rounds (source of truth — ver 0021).
 */
export async function buildMatchEmailMeta(
  supabase: AnySupabase,
  matchId: string,
): Promise<MatchEmailMeta | null> {
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("id, format, set_size")
    .eq("id", matchId)
    .single();
  if (mErr || !match) return null;

  const { data: rounds } = await supabase
    .from("match_rounds")
    .select("team, points")
    .eq("match_id", matchId);
  const scores: Record<number, number> = { 1: 0, 2: 0 };
  for (const r of rounds ?? []) {
    scores[r.team] = (scores[r.team] ?? 0) + Number(r.points ?? 0);
  }

  const { data: mps } = await supabase
    .from("match_players")
    .select("user_id, team")
    .eq("match_id", matchId);
  const userIds = (mps ?? []).map((mp: any) => mp.user_id);

  let byId = new Map<string, { username: string; display_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .in("id", userIds);
    byId = new Map((profiles ?? []).map((p: any) => [p.id, { username: p.username, display_name: p.display_name }]));
  }

  const labelFor = (team: number): string => {
    const names: string[] = [];
    for (const mp of mps ?? []) {
      if (mp.team !== team) continue;
      const p = byId.get(mp.user_id);
      names.push(p?.display_name || p?.username || "?");
    }
    return names.join(" + ") || `Equipo ${team}`;
  };

  const winningTeam: 1 | 2 | null =
    scores[1] > scores[2] ? 1 : scores[2] > scores[1] ? 2 : null;

  return {
    matchId:    match.id,
    format:     "doubles",
    setSize:    (match.set_size ?? "d6") as "d6" | "d9",
    scoreTeam1: scores[1] ?? 0,
    scoreTeam2: scores[2] ?? 0,
    team1Label: labelFor(1),
    team2Label: labelFor(2),
    winningTeam,
  };
}

/**
 * Envía un email a una lista de user_ids vía get_user_email (un lookup por
 * cada uno). Requiere que el caller esté autenticado y autorizado por
 * get_user_email (amigo, friend_request, o coparticipante del match).
 * Best-effort: errores individuales se loguean pero no detienen al resto.
 */
export async function sendToUserIds(
  supabase: AnySupabase,
  userIds: string[],
  buildTemplate: () => { subject: string; html: string; text: string },
): Promise<void> {
  const tpl = buildTemplate();
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const { data: email, error } = await supabase.rpc("get_user_email", { p_user_id: uid });
        if (error) {
          console.warn("[match-notifications] get_user_email failed:", error.message);
          return;
        }
        if (!email) return;
        await sendEmail({ to: email, ...tpl });
      } catch (e) {
        console.error("[match-notifications] sendToUserIds error:", e);
      }
    })
  );
}

/**
 * Envía un email a TODOS los jugadores opted-in del match vía
 * get_match_player_emails (1 RPC, N envíos). Requiere service role.
 * Usado por admin (resolución de disputas) y cron auto-confirm.
 */
export async function sendToMatchPlayers(
  serviceClient: AnySupabase,
  matchId: string,
  buildTemplate: () => { subject: string; html: string; text: string },
): Promise<void> {
  try {
    const { data, error } = await serviceClient.rpc("get_match_player_emails", { p_match_id: matchId });
    if (error) {
      console.warn("[match-notifications] get_match_player_emails failed:", error.message);
      return;
    }
    const tpl = buildTemplate();
    await Promise.all(
      (data ?? []).map(async (row: any) => {
        if (!row?.email) return;
        try {
          await sendEmail({ to: row.email, ...tpl });
        } catch (e) {
          console.error("[match-notifications] sendEmail failed:", e);
        }
      })
    );
  } catch (e) {
    console.error("[match-notifications] sendToMatchPlayers error:", e);
  }
}
