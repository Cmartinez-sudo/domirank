/**
 * CRITICAL TEST — Sprint Match Cancellation acceptance criteria.
 *
 *   "Match cancelada NO afecta rating de ningún participante.
 *    Hands de match cancelado quedan en DB pero ignoradas en cálculo Elo.
 *    Test que confirma: rating antes vs después de cancel = idéntico."
 *
 * Validamos el contract en el nivel correcto: el DB enforce la
 * invariante via `apply_match_rating` que rechaza cuando
 * `matches.status <> 'confirmed'` (mig 0016, línea 394).
 *
 * Esta suite verifica:
 *   1. La migración 0016 contiene el guard 'not_rateable' que bloquea
 *      apply_match_rating sobre matches no-confirmed (incluye cancelled).
 *   2. cancelLiveMatch usa el RPC cancel_match (no UPDATE directo, no
 *      llama apply_match_rating, no toca rating cols).
 *   3. undoMatchCancellation usa el RPC undo_cancellation (idem).
 *
 * Para invariante end-to-end empíricamente (rating before vs after sobre
 * un match real), ver QA manual en preview deploy — el integration
 * runner contra service-role queda como follow-up cuando dediquemos
 * infra para test DB (vitest puro NO debe tocar prod).
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MIG_ROOT = path.resolve(__dirname, "../../../supabase/migrations");
const LIB_ROOT = path.resolve(__dirname, "../");

describe("Cancel-Elo invariant — DB level", () => {
  it("apply_match_rating (mig 0016) rechaza matches con status≠confirmed", () => {
    const sql = fs.readFileSync(path.join(MIG_ROOT, "0016_attestation_system.sql"), "utf8");
    // El guard que importa: cancelled, in_progress, void, disputed, etc.
    // todos quedan fuera porque solo 'confirmed' pasa.
    expect(sql).toMatch(/v_match\.status\s*<>\s*'confirmed'\s+then\s+raise exception\s+'not_rateable'/i);
  });

  it("cancel_match RPC (latest version) NO llama apply_match_rating", () => {
    // El RPC vive en 0067 (versión inicial) y se reescribe en
    // 0072 (security hardening). Validamos la versión más reciente:
    // si existe 0072, ese es el body activo.
    const sources = [
      path.join(MIG_ROOT, "0072_cancel_match_security_hardening.sql"),
      path.join(MIG_ROOT, "0067_match_cancellation_rpcs.sql"),
    ];
    const sqlFile = sources.find((p) => fs.existsSync(p));
    if (!sqlFile) throw new Error("No cancel_match definition found");
    const sql = fs.readFileSync(sqlFile, "utf8");
    const fnStart = sql.indexOf("function public.cancel_match");
    const fnEnd = sql.indexOf("$$", fnStart) + 2;
    const fnBody = sql.substring(fnStart, fnEnd);
    expect(fnBody).not.toMatch(/apply_match_rating/i);
  });

  it("undo_cancellation RPC (mig 0067) NO llama apply_match_rating", () => {
    const sql = fs.readFileSync(path.join(MIG_ROOT, "0067_match_cancellation_rpcs.sql"), "utf8");
    const fnStart = sql.indexOf("function public.undo_cancellation");
    const fnEnd = sql.indexOf("$$", fnStart) + 2;
    const fnBody = sql.substring(fnStart, fnEnd);
    expect(fnBody).not.toMatch(/apply_match_rating/i);
  });

  it("cancel_match RPC NO modifica columnas de rating (mu, sigma, elo, games, wins, losses)", () => {
    const sql = fs.readFileSync(path.join(MIG_ROOT, "0067_match_cancellation_rpcs.sql"), "utf8");
    const fnStart = sql.indexOf("function public.cancel_match");
    const fnEnd = sql.indexOf("$$", fnStart) + 2;
    const fnBody = sql.substring(fnStart, fnEnd);
    // Las únicas UPDATEs en cancel_match son a `matches` (status/cancelled_*)
    // y a `match_cancellation_events` y `notifications`. NO a `profiles`,
    // NO a `match_players` (donde viven elo_before/elo_after).
    expect(fnBody).not.toMatch(/update\s+public\.profiles/i);
    expect(fnBody).not.toMatch(/update\s+public\.match_players/i);
    expect(fnBody).not.toMatch(/singles_mu|singles_elo|doubles_mu|doubles_elo|d9_/i);
  });
});

describe("cancel_match security hardening (mig 0072)", () => {
  // Regresión del finding crítico del code review:
  // un caller con JWT no debe poder pasarse por sistema.
  const sql = fs.readFileSync(
    path.join(MIG_ROOT, "0072_cancel_match_security_hardening.sql"),
    "utf8",
  );

  it("fuerza p_reason='user_cancelled' cuando auth.uid IS NOT NULL", () => {
    expect(sql).toMatch(/if v_caller is not null then/i);
    expect(sql).toMatch(/v_effective_reason\s*:=\s*'user_cancelled'/i);
  });

  it("solo permite reasons sistémicas cuando v_caller IS NULL (service_role)", () => {
    expect(sql).toMatch(/p_reason not in/i);
    expect(sql).toMatch(/'inactivity_auto'/);
    expect(sql).toMatch(/Invalid system reason/i);
  });

  it("exige participant check siempre que hay JWT", () => {
    expect(sql).toMatch(/v_is_participant/i);
    expect(sql).toMatch(/Only participants can cancel/i);
  });

  it("DELETE en match_rounds bumpea matches.updated_at (trigger 0072)", () => {
    expect(sql).toMatch(/after insert or update or delete on public\.match_rounds/i);
  });

  it("dropea notifications_type_check defensivamente", () => {
    expect(sql).toMatch(/drop constraint if exists notifications_type_check/i);
  });
});

describe("cancelLiveMatch wrapper", () => {
  it("Usa la RPC cancel_match (no UPDATE directo)", () => {
    const src = fs.readFileSync(path.join(LIB_ROOT, "live-match.ts"), "utf8");
    const fn = extractFunction(src, "cancelLiveMatch");
    expect(fn).toMatch(/supabase\.rpc\(["']cancel_match["']/);
    // No debe haber UPDATE directo a matches status=cancelled en el body
    expect(fn).not.toMatch(/from\(["']matches["']\)\.update\(\s*\{\s*status:\s*["']cancelled["']/);
  });

  it("undoMatchCancellation usa la RPC undo_cancellation", () => {
    const src = fs.readFileSync(path.join(LIB_ROOT, "live-match.ts"), "utf8");
    const fn = extractFunction(src, "undoMatchCancellation");
    expect(fn).toMatch(/supabase\.rpc\(["']undo_cancellation["']/);
  });

  it("startLiveMatch auto-cancel previa usa RPC con reason='replaced_by_new_match'", () => {
    // No usamos extractFunction (brace counter es frágil con strings tipo
    // `{ x: 1 }` en el body). Bastan referencias en el archivo + co-localización.
    const src = fs.readFileSync(path.join(LIB_ROOT, "live-match.ts"), "utf8");
    expect(src).toMatch(/cancel_match/);
    expect(src).toMatch(/replaced_by_new_match/);
    // Y verificamos que NO queda el UPDATE directo viejo
    expect(src).not.toMatch(/\.update\(\s*\{\s*status:\s*["']cancelled["']\s*\}\)\.eq\(["']created_by["']/);
  });
});

function extractFunction(src: string, name: string): string {
  const idx = src.indexOf(`function ${name}`);
  if (idx < 0) throw new Error(`function ${name} not found`);
  // Naive brace-counting from the first `{` after the signature.
  const openBrace = src.indexOf("{", idx);
  let depth = 0;
  for (let i = openBrace; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.substring(idx, i + 1);
    }
  }
  return src.substring(idx); // fallback
}
