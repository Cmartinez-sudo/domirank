/**
 * Unit tests para validateTournamentConfig (F1.8).
 *
 * Cubre las reglas de validación cross-field del wizard de torneo:
 *  - player_count: cap 4..64 + reglas por formato
 *  - num_boards: 1..10 + sanity vs floor(player_count/4)
 *  - format: 4 valores válidos
 *
 * Run: pnpm vitest run src/lib/__tests__/tournament-validation.test.ts
 */

import { describe, it, expect } from "vitest";
import { validateTournamentConfig, diaDeSemanaEs } from "../tournament-validation";

describe("validateTournamentConfig — happy paths", () => {
  it("continuous_league con 4 jugadores y 1 mesa: válido", () => {
    const res = validateTournamentConfig({
      format: "continuous_league",
      player_count: 4,
      num_boards: 1,
    });
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual({});
  });

  it("continuous_league con 8 jugadores y 2 mesas: válido", () => {
    const res = validateTournamentConfig({
      format: "continuous_league",
      player_count: 8,
      num_boards: 2,
    });
    expect(res.valid).toBe(true);
  });

  it("single_elim con 16 jugadores y 4 mesas: válido", () => {
    const res = validateTournamentConfig({
      format: "single_elim",
      player_count: 16,
      num_boards: 4,
    });
    expect(res.valid).toBe(true);
  });

  it("round_robin con 8 jugadores (par) y 2 mesas: válido", () => {
    const res = validateTournamentConfig({
      format: "round_robin",
      player_count: 8,
      num_boards: 2,
    });
    expect(res.valid).toBe(true);
  });

  it("swiss con 12 jugadores y 3 mesas: válido", () => {
    const res = validateTournamentConfig({
      format: "swiss",
      player_count: 12,
      num_boards: 3,
    });
    expect(res.valid).toBe(true);
  });
});

describe("validateTournamentConfig — player_count cap edges", () => {
  it("player_count = 0 → error mínimo 4", () => {
    const res = validateTournamentConfig({
      format: "swiss",
      player_count: 0,
      num_boards: 1,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.player_count).toContain("Mínimo 4");
  });

  it("player_count = 1 → error mínimo 4", () => {
    const res = validateTournamentConfig({
      format: "swiss",
      player_count: 1,
      num_boards: 1,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.player_count).toContain("Mínimo 4");
  });

  it("player_count = 3 → error mínimo 4", () => {
    const res = validateTournamentConfig({
      format: "single_elim",
      player_count: 3,
      num_boards: 1,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.player_count).toContain("Mínimo 4");
  });

  it("player_count = 65 → error máximo 64", () => {
    const res = validateTournamentConfig({
      format: "swiss",
      player_count: 65,
      num_boards: 2,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.player_count).toContain("Máximo 64");
  });

  it("player_count = 64 exacto y swiss: válido (cap inclusivo)", () => {
    const res = validateTournamentConfig({
      format: "swiss",
      player_count: 64,
      num_boards: 4,
    });
    expect(res.valid).toBe(true);
  });
});

describe("validateTournamentConfig — reglas por formato", () => {
  it("round_robin con 5 jugadores (impar) → error", () => {
    const res = validateTournamentConfig({
      format: "round_robin",
      player_count: 5,
      num_boards: 1,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.player_count).toMatch(/par/i);
  });

  it("single_elim con 7 jugadores (no potencia de 2) → error", () => {
    const res = validateTournamentConfig({
      format: "single_elim",
      player_count: 7,
      num_boards: 1,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.player_count).toMatch(/4, 8, 16, 32 o 64/);
  });

  it("continuous_league con 6 jugadores → error (solo 4 u 8)", () => {
    const res = validateTournamentConfig({
      format: "continuous_league",
      player_count: 6,
      num_boards: 1,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.player_count).toMatch(/4 u 8/);
  });

  it("continuous_league con 16 jugadores → error (solo 4 u 8)", () => {
    const res = validateTournamentConfig({
      format: "continuous_league",
      player_count: 16,
      num_boards: 4,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.player_count).toMatch(/4 u 8/);
  });

  it("single_elim con 32 jugadores → válido (potencia de 2)", () => {
    const res = validateTournamentConfig({
      format: "single_elim",
      player_count: 32,
      num_boards: 8,
    });
    expect(res.valid).toBe(true);
  });
});

describe("validateTournamentConfig — num_boards", () => {
  it("num_boards = 0 → error rango 1..10", () => {
    const res = validateTournamentConfig({
      format: "swiss",
      player_count: 8,
      num_boards: 0,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.num_boards).toContain("1 y 10");
  });

  it("num_boards = 11 → error rango 1..10", () => {
    const res = validateTournamentConfig({
      format: "swiss",
      player_count: 40,
      num_boards: 11,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.num_boards).toContain("1 y 10");
  });

  it("num_boards = 3 con player_count = 8 → error (máximo 2 mesas)", () => {
    // floor(8/4) = 2, num_boards=3 excede
    const res = validateTournamentConfig({
      format: "continuous_league",
      player_count: 8,
      num_boards: 3,
    });
    expect(res.valid).toBe(false);
    expect(res.errors.num_boards).toMatch(/máximo 2 mesa/);
  });

  it("num_boards = 1 con player_count = 4 → válido (1 mesa = 1 match)", () => {
    const res = validateTournamentConfig({
      format: "continuous_league",
      player_count: 4,
      num_boards: 1,
    });
    expect(res.valid).toBe(true);
  });
});

describe("diaDeSemanaEs", () => {
  it("devuelve el día correcto para un domingo", () => {
    // 2025-05-25 fue domingo
    expect(diaDeSemanaEs(new Date("2025-05-25T12:00:00"))).toBe("domingo");
  });

  it("devuelve el día correcto para un viernes", () => {
    // 2025-05-30 fue viernes
    expect(diaDeSemanaEs(new Date("2025-05-30T12:00:00"))).toBe("viernes");
  });
});
