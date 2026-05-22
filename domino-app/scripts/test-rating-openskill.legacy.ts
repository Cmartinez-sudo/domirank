/**
 * LEGACY — Verificación del motor de rating OpenSkill.
 * Archivado durante la migración a Elo (mayo 2025).
 *
 * Este archivo ya no se usa activamente. El nuevo motor Elo
 * tiene cobertura en src/lib/__tests__/rating.test.ts (vitest).
 *
 * Importa desde rating-openskill.legacy.ts para no romper el build.
 * NO EJECUTAR en producción — solo referencia histórica.
 */

import {
  updateRatings,
  winProbability,
  globalRating,
  globalRatingFromTwoFormats,
  DEFAULT_MU,
  DEFAULT_SIGMA,
} from "../src/lib/rating-openskill.legacy";

let passed = 0, failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.log(`  ✗ ${msg}`);
    failed++;
  }
}

console.log("\n=== Test 1: Singles — ganador sube μ, perdedor baja μ ===");
{
  const updates = updateRatings([
    { team: 1, rank: 1, players: [{ user_id: "alice", mu: DEFAULT_MU, sigma: DEFAULT_SIGMA }] },
    { team: 2, rank: 2, players: [{ user_id: "bob",   mu: DEFAULT_MU, sigma: DEFAULT_SIGMA }] },
  ]);
  const a = updates.find(u => u.user_id === "alice")!;
  const b = updates.find(u => u.user_id === "bob")!;
  assert(a.mu_after > a.mu_before, "μ de Alice subió");
  assert(b.mu_after < b.mu_before, "μ de Bob bajó");
  assert(a.sigma_after < a.sigma_before, "σ de Alice bajó (más certeza)");
  assert(b.sigma_after < b.sigma_before, "σ de Bob bajó (más certeza)");
  const deltaA = a.mu_after - a.mu_before;
  const deltaB = b.mu_before - b.mu_after;
  assert(Math.abs(deltaA - deltaB) < 0.01, `Cambio simétrico: ΔAlice=${deltaA.toFixed(3)}, ΔBob=${deltaB.toFixed(3)}`);
}

console.log(`\n=========================================`);
console.log(`  ${passed} pasaron, ${failed} fallaron`);
console.log(`=========================================\n`);
process.exit(failed === 0 ? 0 : 1);
