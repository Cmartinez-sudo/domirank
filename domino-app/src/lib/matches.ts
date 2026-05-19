"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { updateRatings, type TeamInput } from "@/lib/rating";

const TeamSchema = z.object({
  player_ids: z.array(z.string().uuid()).min(1).max(4),
  score: z.number().int().min(0).max(500),
});

const SubmitMatchSchema = z.object({
  format: z.enum(["singles", "doubles"]),
  target_points: z.number().int().min(50).max(500).default(100),
  notes: z.string().max(500).optional(),
  // Equipos ordenados por team_index (1, 2, ...). El ganador se determina por score.
  teams: z.array(TeamSchema).min(2).max(4),
});

export type SubmitMatchInput = z.infer<typeof SubmitMatchSchema>;

export type SubmitMatchResult =
  | { ok: true; match_id: string }
  | { ok: false; error: string };

/**
 * Registra una partida, calcula nuevos ratings y persiste todo.
 *
 * Lógica:
 *  1. Valida formato singles/doubles vs número y tamaño de equipos.
 *  2. Lee ratings actuales de los jugadores (singles_* o doubles_*).
 *  3. Ranks: equipo con mayor score = rank 1, siguiente rank 2, etc.
 *  4. Llama a updateRatings (OpenSkill / Plackett-Luce).
 *  5. INSERTA match + match_players con snapshot before/after.
 *  6. UPDATEa cada profile con μ/σ nuevos, contadores y win/loss.
 *
 * Todo en el cliente del usuario autenticado: RLS valida que sea el creador.
 */
export async function submitMatch(raw: unknown): Promise<SubmitMatchResult> {
  const parsed = SubmitMatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;

  // Validar tamaños según formato
  const expectedTeamSize = input.format === "singles" ? 1 : 2;
  for (const t of input.teams) {
    if (t.player_ids.length !== expectedTeamSize) {
      return { ok: false, error: `En ${input.format}, cada equipo debe tener ${expectedTeamSize} jugador(es).` };
    }
  }
  // No repetir jugadores
  const allIds = input.teams.flatMap((t) => t.player_ids);
  if (new Set(allIds).size !== allIds.length) {
    return { ok: false, error: "Un jugador no puede estar en dos equipos." };
  }
  // Debe haber un único ganador (mayor score estricto)
  const maxScore = Math.max(...input.teams.map((t) => t.score));
  const winners = input.teams.filter((t) => t.score === maxScore);
  if (winners.length !== 1) {
    return { ok: false, error: "Tiene que haber un solo ganador (empates no se rankean)." };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Leer ratings actuales
  const muCol    = input.format === "singles" ? "singles_mu"    : "doubles_mu";
  const sigmaCol = input.format === "singles" ? "singles_sigma" : "doubles_sigma";

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select(`id, username, ${muCol}, ${sigmaCol}`)
    .in("id", allIds);

  if (pErr) return { ok: false, error: pErr.message };
  if (!profiles || profiles.length !== allIds.length) {
    return { ok: false, error: "Alguno de los jugadores no existe." };
  }
  const byId = new Map(profiles.map((p: any) => [p.id, p]));

  // Construir TeamInput para OpenSkill
  // rank = 1 + (#equipos con score estrictamente mayor que el mío)
  const teamInputs: TeamInput[] = input.teams.map((t, i) => {
    const rank = 1 + input.teams.filter((o) => o.score > t.score).length;
    return {
      team: i + 1,
      rank,
      players: t.player_ids.map((id) => {
        const p: any = byId.get(id);
        return {
          user_id: id,
          mu: Number(p[muCol]),
          sigma: Number(p[sigmaCol]),
        };
      }),
    };
  });

  const updates = updateRatings(teamInputs);

  // INSERT match
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .insert({
      format: input.format,
      target_points: input.target_points,
      status: "completed",
      notes: input.notes,
      rated: true,
      created_by: user.id,
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (mErr || !match) return { ok: false, error: mErr?.message ?? "No se pudo crear el match" };

  // INSERT match_players (uno por jugador)
  const mpRows = input.teams.flatMap((t, i) =>
    t.player_ids.map((pid) => {
      const u = updates.find((x) => x.user_id === pid && x.team === i + 1)!;
      return {
        match_id: match.id,
        user_id: pid,
        team: i + 1,
        score: t.score,
        rank: u.rank,
        mu_before: u.mu_before,
        sigma_before: u.sigma_before,
        mu_after: u.mu_after,
        sigma_after: u.sigma_after,
      };
    })
  );
  const { error: mpErr } = await supabase.from("match_players").insert(mpRows);
  if (mpErr) {
    // Rollback manual del match
    await supabase.from("matches").delete().eq("id", match.id);
    return { ok: false, error: mpErr.message };
  }

  // UPDATE profiles con ratings nuevos y contadores
  for (const u of updates) {
    const won = u.rank === 1;
    const patch: Record<string, unknown> = {};
    if (input.format === "singles") {
      patch.singles_mu = u.mu_after;
      patch.singles_sigma = u.sigma_after;
    } else {
      patch.doubles_mu = u.mu_after;
      patch.doubles_sigma = u.sigma_after;
    }
    // Incrementar contadores con RPC simple: fetch + update.
    const { data: cur } = await supabase
      .from("profiles")
      .select(`${input.format}_games, ${input.format}_wins, ${input.format}_losses`)
      .eq("id", u.user_id)
      .single();
    if (cur) {
      patch[`${input.format}_games`]  = (cur as any)[`${input.format}_games`]  + 1;
      patch[`${input.format}_wins`]   = (cur as any)[`${input.format}_wins`]   + (won ? 1 : 0);
      patch[`${input.format}_losses`] = (cur as any)[`${input.format}_losses`] + (won ? 0 : 1);
    }
    await supabase.from("profiles").update(patch).eq("id", u.user_id);
  }

  return { ok: true, match_id: match.id };
}
