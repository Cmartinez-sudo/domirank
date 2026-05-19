/**
 * Verificación del motor de rating.
 * Ejecuta: npm run test:rating
 */

import { updateRatings, winProbability, globalRating, globalRatingFromTwoFormats, DEFAULT_MU, DEFAULT_SIGMA } from "../src/lib/rating";

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
  // Simetría: el cambio en μ debería ser de magnitud similar
  const deltaA = a.mu_after - a.mu_before;
  const deltaB = b.mu_before - b.mu_after;
  assert(Math.abs(deltaA - deltaB) < 0.01, `Cambio simétrico: ΔAlice=${deltaA.toFixed(3)}, ΔBob=${deltaB.toFixed(3)}`);
}

console.log("\n=== Test 2: Doubles — equipo ganador sube en bloque ===");
{
  const updates = updateRatings([
    { team: 1, rank: 1, players: [
      { user_id: "a1", mu: DEFAULT_MU, sigma: DEFAULT_SIGMA },
      { user_id: "a2", mu: DEFAULT_MU, sigma: DEFAULT_SIGMA },
    ]},
    { team: 2, rank: 2, players: [
      { user_id: "b1", mu: DEFAULT_MU, sigma: DEFAULT_SIGMA },
      { user_id: "b2", mu: DEFAULT_MU, sigma: DEFAULT_SIGMA },
    ]},
  ]);
  const a1 = updates.find(u => u.user_id === "a1")!;
  const b1 = updates.find(u => u.user_id === "b1")!;
  assert(a1.mu_after > a1.mu_before, "μ de a1 subió");
  assert(b1.mu_after < b1.mu_before, "μ de b1 bajó");
}

console.log("\n=== Test 3: Convergencia — σ disminuye con más partidas ===");
{
  let mu = DEFAULT_MU, sigma = DEFAULT_SIGMA;
  const initialSigma = sigma;
  for (let i = 0; i < 30; i++) {
    const r = updateRatings([
      { team: 1, rank: 1, players: [{ user_id: "p", mu, sigma }] },
      { team: 2, rank: 2, players: [{ user_id: "x", mu: DEFAULT_MU, sigma: DEFAULT_SIGMA }] },
    ]);
    const me = r.find(u => u.user_id === "p")!;
    mu = me.mu_after; sigma = me.sigma_after;
  }
  // OpenSkill es conservador: cuando el resultado confirma la predicción,
  // la varianza baja gradualmente. Verificamos una reducción significativa (>25%).
  assert(sigma < initialSigma * 0.75, `σ se redujo >25% tras 30 victorias (σ final = ${sigma.toFixed(3)})`);
  console.log(`    μ final tras 30 victorias seguidas: ${mu.toFixed(2)}`);
}

console.log("\n=== Test 4: Upset — perder contra alguien mucho peor cuesta mucho ===");
{
  const updates = updateRatings([
    { team: 1, rank: 1, players: [{ user_id: "weak",   mu: 20, sigma: 4 }] },
    { team: 2, rank: 2, players: [{ user_id: "strong", mu: 35, sigma: 4 }] },
  ]);
  const strong = updates.find(u => u.user_id === "strong")!;
  const weak   = updates.find(u => u.user_id === "weak")!;
  const lostMu = strong.mu_before - strong.mu_after;
  const wonMu  = weak.mu_after - weak.mu_before;
  console.log(`    Strong (35) perdió contra Weak (20): Δμ strong = -${lostMu.toFixed(3)}, Δμ weak = +${wonMu.toFixed(3)}`);
  assert(lostMu > 1.0, "El fuerte perdió >1.0 μ al caer ante el débil");
  assert(wonMu > 1.0, "El débil ganó >1.0 μ al vencer al fuerte");
}

console.log("\n=== Test 5: winProbability — el favorito tiene >50% ===");
{
  const p = winProbability(
    [{ user_id: "fav", mu: 32, sigma: 3 }],
    [{ user_id: "und", mu: 22, sigma: 3 }],
  );
  console.log(`    P(fav gana) = ${(p * 100).toFixed(1)}%`);
  assert(p > 0.7, "Favorito tiene >70%");
  assert(p < 1.0, "No es certeza absoluta");
}

console.log("\n=== Test 6: Free-for-all (4 jugadores, ranking lineal) ===");
{
  const updates = updateRatings([
    { team: 1, rank: 1, players: [{ user_id: "1st", mu: 25, sigma: 8.33 }] },
    { team: 2, rank: 2, players: [{ user_id: "2nd", mu: 25, sigma: 8.33 }] },
    { team: 3, rank: 3, players: [{ user_id: "3rd", mu: 25, sigma: 8.33 }] },
    { team: 4, rank: 4, players: [{ user_id: "4th", mu: 25, sigma: 8.33 }] },
  ]);
  const u = (id: string) => updates.find(x => x.user_id === id)!;
  assert(u("1st").mu_after > u("2nd").mu_after, "1° > 2°");
  assert(u("2nd").mu_after > u("3rd").mu_after, "2° > 3°");
  assert(u("3rd").mu_after > u("4th").mu_after, "3° > 4°");
}

console.log("\n=== Test 7: DomiRank Global — combinación Bayesiana 2-bucket (legacy) ===");
{
  const c1 = globalRatingFromTwoFormats(25, 25/3, 25, 25/3);
  assert(Math.abs(c1.mu - 25) < 0.01, `Defaults dan μ_global ≈ 25 (got ${c1.mu.toFixed(3)})`);

  const c2 = globalRatingFromTwoFormats(25, 25/3, 30, 2.5);
  console.log(`    Solo parejas d6 (μ=30 σ=2.5): global μ=${c2.mu.toFixed(2)} σ=${c2.sigma.toFixed(2)} peso=${(c2.weights.d6_doubles*100).toFixed(0)}%`);
  // Con 4 buckets (uno con info, 3 defaults), el dominante pesa ~79%,
  // suficiente para que el global se acerque al lado con info (μ→30) sin saturarse.
  assert(c2.mu > 28.5 && c2.mu < 30.0, `Global μ entre 28.5 y 30 (atraído por formato dominante)`);
  assert(c2.weights.d6_doubles > 0.75, `d6_doubles pesa >75% cuando solo juegas eso (vs los 3 defaults restantes)`);

  const c3 = globalRatingFromTwoFormats(28, 2, 32, 4);
  console.log(`    Singles d6 (μ=28 σ=2) vs Doubles d6 (μ=32 σ=4): global μ=${c3.mu.toFixed(2)} (peso singles ${(c3.weights.d6_singles*100).toFixed(0)}%)`);
  assert(c3.weights.d6_singles > 0.7, `σ menor pesa más en el global`);
  assert(c3.mu < 30, `Global se acerca al lado con σ menor`);
}

console.log("\n=== Test 8: DomiRank Global — 4 buckets (singles/doubles × d6/d9) ===");
{
  // Defaults en todo → μ=25, σ menor que cualquier bucket individual
  const c1 = globalRating({
    d6_singles: { mu: 25, sigma: 25/3 },
    d6_doubles: { mu: 25, sigma: 25/3 },
    d9_singles: { mu: 25, sigma: 25/3 },
    d9_doubles: { mu: 25, sigma: 25/3 },
  });
  assert(Math.abs(c1.mu - 25) < 0.01, `4 defaults → μ_global = 25`);
  assert(c1.sigma < 25/3 / 1.9, `σ_global con 4 buckets default = ${c1.sigma.toFixed(2)}, debe ser ~25/3/2 ≈ 4.17`);
  console.log(`    4 defaults: σ_global = ${c1.sigma.toFixed(2)} (la mitad de individual)`);

  // Solo doubles d6 jugado → global domina d6_doubles
  const c2 = globalRating({
    d6_singles: { mu: 25, sigma: 25/3 },
    d6_doubles: { mu: 30, sigma: 2.5 },
    d9_singles: { mu: 25, sigma: 25/3 },
    d9_doubles: { mu: 25, sigma: 25/3 },
  });
  console.log(`    Solo d6_doubles activo: μ=${c2.mu.toFixed(2)} σ=${c2.sigma.toFixed(2)} (peso d6_d=${(c2.weights.d6_doubles*100).toFixed(0)}%)`);
  assert(c2.weights.d6_doubles > 0.75, `d6_doubles pesa >75% del global con 3 buckets default`);

  // Jugador balanceado en d6 y d9 (caso cubano-venezolano)
  const c3 = globalRating({
    d6_singles: { mu: 25, sigma: 25/3 },
    d6_doubles: { mu: 30, sigma: 2.5 },
    d9_singles: { mu: 25, sigma: 25/3 },
    d9_doubles: { mu: 28, sigma: 3.0 },
  });
  console.log(`    d6 (30/2.5) + d9 (28/3): μ=${c3.mu.toFixed(2)} σ=${c3.sigma.toFixed(2)}`);
  assert(c3.mu > 28 && c3.mu < 30, `Global queda entre los dos buckets jugados`);
  assert(c3.sigma < 2.5, `σ baja al combinar dos buckets con info`);
}

console.log(`\n=========================================`);
console.log(`  ${passed} pasaron, ${failed} fallaron`);
console.log(`=========================================\n`);
process.exit(failed === 0 ? 0 : 1);
