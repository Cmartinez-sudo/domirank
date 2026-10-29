/**
 * Canary de regresión para el double-count del leaderboard de torneos.
 *
 * Bug 2026-07-31: partida 106–33 mostraba 212 y 66 en el leaderboard
 * (2× el score real). Causa: `sum(match_players.score)` particionado por
 * team dentro de un mismo match dobla en 2v2 porque `match_players.score`
 * está denormalizado (todos los jugadores del team tienen el mismo valor).
 *
 * Este test lee la migración vigente que define `get_tournament_standings`
 * y falla si vuelve a aparecer el patrón peligroso `sum(mp2.score)` sobre
 * teammates. Es un canary, no una validación semántica del SQL — no puede
 * correr Postgres — pero previene la regresión exacta.
 *
 * Si necesitas refactorizar la RPC en el futuro, actualiza el path o el
 * chequeo a lo que aplique al nuevo diseño (ej: si migras a leer de
 * match_rounds, el patrón peligroso desaparece del todo).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../supabase/migrations");

/**
 * Devuelve la migración más reciente que define get_tournament_standings,
 * con los comentarios de línea (`-- ...`) y de bloque removidos. Los
 * comentarios de la migración 0103 describen textualmente el patrón buggy
 * para documentar la lección aprendida; queremos matchear SQL vivo, no
 * documentación histórica.
 */
function latestStandingsMigration(): { file: string; sql: string } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let latest: { file: string; sqlRaw: string } | null = null;
  for (const file of files) {
    const sqlRaw = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    if (/create\s+(or\s+replace\s+)?function\s+public\.get_tournament_standings/i.test(sqlRaw)) {
      latest = { file, sqlRaw };
    }
  }
  if (!latest) throw new Error("No migration defines get_tournament_standings");

  const sql = latest.sqlRaw
    .replace(/\/\*[\s\S]*?\*\//g, "")     // /* block comments */
    .replace(/--[^\n]*/g, "");             // -- line comments
  return { file: latest.file, sql };
}

describe("get_tournament_standings — canary contra double-count 2v2", () => {
  it("la migración más reciente NO usa sum(mp2.score) entre teammates", () => {
    const { file, sql } = latestStandingsMigration();

    // Patrón peligroso: sum(<alias>.score) dentro de un scope con
    // where team = mp.team (o team <> mp.team). Ese es EXACTAMENTE el
    // bug de 0101 que 0103 arregla. Regresarlo dobla PF/PC.
    const dangerous = /sum\s*\(\s*\w+\.score\s*\)[\s\S]{0,200}team\s*(=|<>)\s*mp\.team/i;

    expect(
      dangerous.test(sql),
      `${file} reintrodujo el patrón sum(<alias>.score) sobre teammates. ` +
      `match_players.score está denormalizado por team (ver mig 0051, 0103). ` +
      `Usa max(<alias>.score) o lee de match_rounds.`
    ).toBe(false);
  });

  it("la migración más reciente extrae team_score sin sumar entre teammates", () => {
    const { sql } = latestStandingsMigration();

    // El fix aceptado usa max(mp2.score); también sería válido leer de
    // match_rounds. Aceptamos cualquiera de esos patrones como señal
    // de que el double-count fue considerado.
    const safeMax = /max\s*\(\s*\w+\.score\s*\)[\s\S]{0,200}team\s*(=|<>)/i;
    const safeRounds = /match_rounds[\s\S]{0,200}team\s*(=|<>)/i;

    expect(
      safeMax.test(sql) || safeRounds.test(sql),
      "La RPC debe derivar team_score/opp_score con max(score) o desde match_rounds — no con sum."
    ).toBe(true);
  });
});

/**
 * Invariante documentada como test:
 *
 * `match_players.score` está denormalizado por team.
 *   - Escritura (syncMatchScores en src/lib/live-match.ts): hace
 *     `update match_players set score = team_total where team = X` — todos
 *     los jugadores del team quedan con el MISMO valor (score de la pareja).
 *   - Lectura correcta del score de UN team en UN match: max/min/cualquier
 *     row del team (NO sum entre teammates).
 *   - Lectura correcta del total de UN jugador en N matches: sum(mp.score)
 *     agrupando por user_id (una fila por match — no hay doble conteo).
 */
describe("match_players.score — invariante de denormalización", () => {
  it("simula el bug para documentar la convención", () => {
    // Fixture: partida 2v2 106–33. Cada jugador tiene el team_score
    // completo denormalizado en su fila.
    const matchPlayers = [
      { user_id: "A1", team: 1, score: 106 }, // ganador
      { user_id: "A2", team: 1, score: 106 }, // ganador
      { user_id: "B1", team: 2, score: 33 },  // perdedor
      { user_id: "B2", team: 2, score: 33 },  // perdedor
    ];

    const sumByTeam = (team: number) =>
      matchPlayers.filter((p) => p.team === team).reduce((a, p) => a + p.score, 0);
    const maxByTeam = (team: number) =>
      Math.max(...matchPlayers.filter((p) => p.team === team).map((p) => p.score));

    // BUG: sum entre teammates dobla.
    expect(sumByTeam(1)).toBe(212);
    expect(sumByTeam(2)).toBe(66);

    // CORRECTO: max (o cualquier row) del team devuelve el team_score real.
    expect(maxByTeam(1)).toBe(106);
    expect(maxByTeam(2)).toBe(33);
  });
});
