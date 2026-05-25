/**
 * berger-schedule.ts
 *
 * Algoritmo de Berger ("circle method") para round-robin.
 * Módulo puro — sin dependencias de React ni servidor.
 *
 * Importar con ruta relativa en tests: import { ... } from './berger-schedule'
 */

export type BergerMatchup = {
  round: number;
  board: number;
  teamAIndex: number;
  teamBIndex: number;
  /** true si uno de los dos "equipos" es un bye ficticio (índice >= teamCount). */
  isBye: boolean;
};

/**
 * Genera el schedule completo de round-robin para `teamCount` equipos.
 *
 * Algoritmo "circle method":
 *   - Fija el equipo en la posición 0.
 *   - Rota los demás en sentido horario en cada ronda.
 *   - Si `teamCount` es impar, agrega un equipo ficticio (BYE) para tener
 *     N+1 participantes (par), generando N rondas totales — cada equipo real
 *     tiene exactamente 1 bye durante el torneo.
 *   - Si `teamCount` es par, genera N-1 rondas — cada equipo juega N-1
 *     partidas (una contra cada rival).
 *
 * Complejidad: O(n²) tiempo, O(n²) espacio.
 *
 * @param teamCount - número de equipos reales (sin contar byes)
 * @returns array de BergerMatchup ordenados por ronda y board
 *
 * @example
 * // 4 equipos → 3 rondas, 2 matchups por ronda, sin byes
 * bergerSchedule(4)
 * // [{round:1,board:1,teamAIndex:0,teamBIndex:3,isBye:false}, ...]
 *
 * @example
 * // 3 equipos → 3 rondas, 1 matchup real + 1 bye por ronda
 * bergerSchedule(3)
 */
export function bergerSchedule(teamCount: number): BergerMatchup[] {
  if (teamCount < 2) return [];

  // N par → N-1 rondas; N impar → agrega BYE ficticio → N+1 → N rondas
  const n = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  const totalRounds = n - 1;

  // Posiciones "circulantes": índice 0 fijo, índices 1..n-1 rotan
  // Los índices >= teamCount representan el BYE ficticio
  const rotating: number[] = Array.from({ length: n - 1 }, (_, i) => i + 1);

  const result: BergerMatchup[] = [];

  for (let r = 0; r < totalRounds; r++) {
    const circle = [0, ...rotating];
    let board = 1;

    // n/2 pares por ronda (siempre entero porque n es par)
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];

      const isByeA = a >= teamCount;
      const isByeB = b >= teamCount;

      result.push({
        round: r + 1,
        board,
        teamAIndex: a,
        teamBIndex: b,
        isBye: isByeA || isByeB,
      });
      board++;
    }

    // Rotación horaria: el último de `rotating` pasa al frente
    rotating.unshift(rotating.pop()!);
  }

  return result;
}
