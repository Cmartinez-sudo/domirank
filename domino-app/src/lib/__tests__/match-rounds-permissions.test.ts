/**
 * Canary de regresión para el modelo de permisos de match_rounds.
 *
 * Historia:
 *   • Mig 0058 (2025) puso RLS restrictiva: solo el score-keeper activo
 *     podía INSERT; edit tenía attestation. Diseñado para "Active Match
 *     Awareness" C2.
 *   • Reporte 2026-08-03: un jugador de un torneo se metió a anotar
 *     puntos en su partida y le dio error (bloqueado por RLS).
 *   • Decisión: modelo simétrico — cualquier match_player puede
 *     INSERT/UPDATE/DELETE mientras el match esté in_progress. La
 *     confianza es social (4 amigos en la mesa) y el audit
 *     (recorded_by_user_id, last_edited_by_user_id) registra quién
 *     hizo qué.
 *
 * Este test es un canary: si alguien vuelve a introducir un gate de
 * score-keeper en las RLS de match_rounds, falla y explica por qué.
 * NO ejecuta Postgres — verifica el shape del SQL de la migración vigente.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

/**
 * Última migración que declara policies de match_rounds. Retorna el SQL
 * activo (sin comentarios) para poder buscar patrones sin matchear la
 * documentación histórica.
 */
function latestMatchRoundsPolicies(): { file: string; sql: string } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let latest: { file: string; raw: string } | null = null;
  for (const file of files) {
    const raw = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    if (/create\s+policy\s+match_rounds_(insert|update|delete)/i.test(raw)) {
      latest = { file, raw };
    }
  }
  if (!latest) throw new Error("No migration declares match_rounds policies");
  return { file: latest.file, sql: stripSqlComments(latest.raw) };
}

describe("match_rounds RLS — canary contra vuelta al modelo de score-keeper", () => {
  it("la migración vigente no usa can_record_hand como gate de INSERT", () => {
    const { file, sql } = latestMatchRoundsPolicies();

    // El bug 2026-08-03 era exactamente esto: la policy INSERT llamaba
    // can_record_hand (que requería ser el active keeper). Volver a
    // introducirlo reintroduce el bug.
    const dangerous = /create\s+policy\s+match_rounds_insert[\s\S]*?can_record_hand/i;

    expect(
      dangerous.test(sql),
      `${file} reintrodujo can_record_hand como gate del INSERT policy. ` +
      `El modelo actual es simétrico: cualquier match_player anota (mig 0104). ` +
      `Si necesitas un chequeo, usa exists(match_players ...) directo.`
    ).toBe(false);
  });

  it("las 3 policies (insert/update/delete) chequean match_players", () => {
    const { sql } = latestMatchRoundsPolicies();

    for (const action of ["insert", "update", "delete"] as const) {
      const policyRe = new RegExp(
        `create\\s+policy\\s+match_rounds_${action}[\\s\\S]*?match_players`,
        "i"
      );
      expect(
        policyRe.test(sql),
        `La policy ${action} de match_rounds debe chequear match_players ` +
        `(cualquier jugador de la mesa puede anotar/editar/borrar).`
      ).toBe(true);
    }
  });
});

describe("insert_match_round RPC — anti-race concurrente", () => {
  it("la migración vigente declara la RPC atómica insert_match_round", () => {
    const { sql } = latestMatchRoundsPolicies();

    // Con RLS abierta a 4 jugadores, el SELECT max+1 en TS tiene race.
    // La RPC lo soluciona con advisory lock. Ausencia = fix incompleto.
    const hasRpc = /create\s+(or\s+replace\s+)?function\s+public\.insert_match_round/i.test(sql);
    expect(
      hasRpc,
      "Falta la RPC insert_match_round que serializa inserts concurrentes. " +
      "Sin ella, 2 jugadores anotando a la vez pueden colisionar en round_number."
    ).toBe(true);

    // Debe usar advisory lock (o SERIALIZABLE) — no basta un SELECT sin protección.
    const hasLock = /pg_advisory[_a-z]*lock|isolation\s+level\s+serializable/i.test(sql);
    expect(
      hasLock,
      "insert_match_round debe usar pg_advisory_xact_lock (u otro mecanismo) " +
      "para prevenir race conditions en round_number."
    ).toBe(true);
  });
});

/**
 * Invariante conceptual documentada como test — sin ejecutar SQL,
 * explica qué se espera del modelo nuevo.
 */
describe("modelo simétrico — invariante documentada", () => {
  it("cualquier match_player puede anotar; el audit captura quién", () => {
    // Fixture conceptual: partida con 4 jugadores. B (que no es el
    // creador ni tenía scorekeeper role) anota una mano. Debe funcionar.
    const matchPlayers = new Set(["A", "B", "C", "D"]);
    const creatorId = "A"; // modelo viejo: solo A podía anotar
    const anotator = "B";

    const canAnotate = (uid: string) => matchPlayers.has(uid);

    expect(canAnotate(anotator)).toBe(true);
    expect(canAnotate(creatorId)).toBe(true);
    expect(canAnotate("outsider")).toBe(false);
  });
});
