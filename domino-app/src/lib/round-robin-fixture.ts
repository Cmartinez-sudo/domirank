/**
 * Generador de fixtures para el formato Round Robin Individual.
 *
 * Formato: N jugadores individuales, cada partida 2v2 (4 en la mesa), ranking
 * individual. Un "ciclo" (una Ronda) debe cumplir:
 *   • Cada pair de jugadores juega como PAREJA exactamente 1 vez
 *   • Cada pair de jugadores enfrenta como RIVALES exactamente 2 veces
 *   • Descansos distribuidos parejamente
 *
 * Soporta N ∈ {4, 5} en el sprint inicial. Otros N ∈ {8, 9, ...} requieren
 * Whist tournament designs (Bose-Nair) que se agregan en un follow-up.
 *
 * Los fixtures están hardcodeados como índices [0..N-1]. El caller mapea los
 * índices a user_ids en el orden de inscripción.
 *
 * Con R > 1, el ciclo se repite tal cual: R rondas = R×base_partidas totales.
 */

export const SUPPORTED_PLAYER_COUNTS = [4, 5] as const;
export type SupportedPlayerCount = (typeof SUPPORTED_PLAYER_COUNTS)[number];

export function isSupportedPlayerCount(n: number): n is SupportedPlayerCount {
  return (SUPPORTED_PLAYER_COUNTS as readonly number[]).includes(n);
}

/**
 * Una partida planificada. Índices refieren a slots de jugador
 * [0..N-1]. `resting` es la lista de índices que descansan en esa partida
 * (vacía si todos juegan, ej. N=4 y N=8).
 */
export type PlannedMatch = {
  /** Número de partida dentro del ciclo (1..cyclePartidas). */
  matchNumber: number;
  /** Índices de los 2 jugadores de home team. */
  home: [number, number];
  /** Índices de los 2 jugadores de away team. */
  away: [number, number];
  /** Índices de los jugadores que descansan (0..N-4 típicamente). */
  resting: number[];
};

/**
 * Fixture completo de un ciclo (1 Ronda) para N jugadores.
 * total_partidas = matches.length.
 */
export type Fixture = {
  playerCount: SupportedPlayerCount;
  matches: PlannedMatch[];
};

// ─── Fixtures hardcodeados ────────────────────────────────────────────────

/**
 * N=4: 3 partidas, sin descansos. Cada pair de jugadores juega con cada otro
 * como pareja exactamente 1× y como rival 2×. Solución trivial: las 3
 * partitions posibles del set {0,1,2,3} en 2 duplas.
 */
const FIXTURE_4: PlannedMatch[] = [
  { matchNumber: 1, home: [0, 1], away: [2, 3], resting: [] },
  { matchNumber: 2, home: [0, 2], away: [1, 3], resting: [] },
  { matchNumber: 3, home: [0, 3], away: [1, 2], resting: [] },
];

/**
 * N=5: 5 partidas, 1 descanso por partida. Cada player descansa 1 vez.
 * Spec del user (mapeado A=0, B=1, C=2, D=3, E=4):
 *   P1: rest A · BC vs DE     → home [B,C]=[1,2] away [D,E]=[3,4] rest [A]=[0]
 *   P2: rest B · CD vs EA     → home [C,D]=[2,3] away [E,A]=[4,0] rest [B]=[1]
 *   P3: rest C · DA vs EB     → home [D,A]=[3,0] away [E,B]=[4,1] rest [C]=[2]
 *   P4: rest D · EC vs AB     → home [E,C]=[4,2] away [A,B]=[0,1] rest [D]=[3]
 *   P5: rest E · AC vs BD     → home [A,C]=[0,2] away [B,D]=[1,3] rest [E]=[4]
 */
const FIXTURE_5: PlannedMatch[] = [
  { matchNumber: 1, home: [1, 2], away: [3, 4], resting: [0] },
  { matchNumber: 2, home: [2, 3], away: [4, 0], resting: [1] },
  { matchNumber: 3, home: [3, 0], away: [4, 1], resting: [2] },
  { matchNumber: 4, home: [4, 2], away: [0, 1], resting: [3] },
  { matchNumber: 5, home: [0, 2], away: [1, 3], resting: [4] },
];

// TODO: N=8 y N=9 requieren Whist tournament designs (Bose-Nair). Se
// dejan fuera del sprint inicial. Cuando se agreguen: extender
// SUPPORTED_PLAYER_COUNTS + agregar FIXTURE_8, FIXTURE_9 con tests que
// validen las reglas matemáticas.

const FIXTURES: Record<SupportedPlayerCount, PlannedMatch[]> = {
  4: FIXTURE_4,
  5: FIXTURE_5,
};

// ─── API ──────────────────────────────────────────────────────────────────

/**
 * Genera el fixture completo para N jugadores. Solo N soportados
 * ({4, 5, 8, 9}) — otros lanzan error.
 *
 * Los índices retornados están en [0..N-1]. El caller mapea a user_ids.
 */
export function generateFixture(playerCount: number): Fixture {
  if (!isSupportedPlayerCount(playerCount)) {
    throw new Error(
      `Round Robin Individual solo soporta ${SUPPORTED_PLAYER_COUNTS.join(", ")} jugadores. Recibido: ${playerCount}.`,
    );
  }
  return { playerCount, matches: FIXTURES[playerCount] };
}

/**
 * Genera R rondas del fixture (mismo ciclo repetido). Los `matchNumber`
 * quedan consecutivos: para R=2 y N=5, las partidas van 1..10.
 */
export function generateMultiRoundFixture(
  playerCount: number,
  rounds: number,
): PlannedMatch[] {
  if (rounds < 1) {
    throw new Error(`rounds debe ser >= 1. Recibido: ${rounds}.`);
  }
  const base = generateFixture(playerCount).matches;
  const output: PlannedMatch[] = [];
  for (let r = 0; r < rounds; r++) {
    for (const m of base) {
      output.push({
        matchNumber: r * base.length + m.matchNumber,
        home: [...m.home] as [number, number],
        away: [...m.away] as [number, number],
        resting: [...m.resting],
      });
    }
  }
  return output;
}

// ─── Validaciones (utilities usadas por tests + al runtime) ───────────────

/**
 * Cuenta cuántas veces cada pair (a, b) aparece como pareja y como rival en
 * un array de partidas. Devuelve dos Maps con las cuentas.
 */
export function countPairInteractions(matches: PlannedMatch[], playerCount: number) {
  const asPartner = new Map<string, number>();
  const asRival = new Map<string, number>();

  const key = (a: number, b: number): string => {
    const [x, y] = a < b ? [a, b] : [b, a];
    return `${x}-${y}`;
  };

  // Inicializar con 0 para todos los pares.
  for (let i = 0; i < playerCount; i++) {
    for (let j = i + 1; j < playerCount; j++) {
      asPartner.set(key(i, j), 0);
      asRival.set(key(i, j), 0);
    }
  }

  for (const m of matches) {
    // Parejas del home team + parejas del away team.
    const homeKey = key(m.home[0], m.home[1]);
    const awayKey = key(m.away[0], m.away[1]);
    asPartner.set(homeKey, (asPartner.get(homeKey) ?? 0) + 1);
    asPartner.set(awayKey, (asPartner.get(awayKey) ?? 0) + 1);

    // Rivales: cada jugador de home vs cada jugador de away.
    for (const h of m.home) {
      for (const a of m.away) {
        const k = key(h, a);
        asRival.set(k, (asRival.get(k) ?? 0) + 1);
      }
    }
  }

  return { asPartner, asRival };
}

/**
 * Cuenta partidas jugadas y descansadas por cada índice de jugador.
 */
export function countPlayerStats(matches: PlannedMatch[], playerCount: number) {
  const played = Array<number>(playerCount).fill(0);
  const rested = Array<number>(playerCount).fill(0);
  for (const m of matches) {
    for (const p of [...m.home, ...m.away]) played[p]! += 1;
    for (const p of m.resting) rested[p]! += 1;
  }
  return { played, rested };
}
