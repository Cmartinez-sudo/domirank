/** @vitest-environment jsdom */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DailyLeaderboard } from "../DailyLeaderboard";
import type { ContinuousLeagueDailyStandingsRow } from "@/types/continuous-league";

afterEach(() => cleanup());

function row(
  overrides: Partial<ContinuousLeagueDailyStandingsRow> = {},
): ContinuousLeagueDailyStandingsRow {
  return {
    user_id:        "a",
    username:       "carlos",
    display_name:   "Carlos",
    avatar_url:     null,
    total_points:   200,
    wins:           2,
    losses:         1,
    win_pct:        67,
    games_played:   3,
    current_streak: "2W",
    is_day_winner:  false,
    ...overrides,
  };
}

describe("DailyLeaderboard", () => {
  it("empty state cuando todos los rows tienen games_played=0", () => {
    const rows: ContinuousLeagueDailyStandingsRow[] = [
      row({ user_id: "a", games_played: 0, total_points: 0, wins: 0, losses: 0, win_pct: 0, current_streak: "—" }),
      row({ user_id: "b", username: "erik", display_name: "Erik", games_played: 0, total_points: 0, wins: 0, losses: 0, win_pct: 0, current_streak: "—" }),
    ];
    const { container } = render(<DailyLeaderboard rows={rows} currentUserId="a" />);
    expect(container.textContent).toContain("Aún no se han jugado partidas hoy");
    expect(container.querySelector("table")).toBeNull();
  });

  it("empty state cuando rows está vacío", () => {
    const { container } = render(<DailyLeaderboard rows={[]} currentUserId="a" />);
    expect(container.textContent).toContain("Aún no se han jugado partidas hoy");
  });

  it("renderiza la tabla con columnas # / Jugador / Pts / V / D / % / Racha", () => {
    const rows = [row({ user_id: "a", is_day_winner: true })];
    const { container } = render(<DailyLeaderboard rows={rows} currentUserId="a" />);
    const headers = Array.from(container.querySelectorAll("th")).map((th) => th.textContent);
    expect(headers).toEqual(["#", "Jugador", "Pts", "V", "D", "%", "Racha"]);
  });

  it("row con is_day_winner=true muestra 👑 antes del nombre", () => {
    const rows = [
      row({ user_id: "a", display_name: "Carlos", is_day_winner: true }),
      row({ user_id: "b", username: "erik", display_name: "Erik", is_day_winner: false }),
    ];
    const { container } = render(<DailyLeaderboard rows={rows} currentUserId="a" />);
    const winnerCell = container.querySelector('tr[data-user-id="a"] [data-testid="player-name"]');
    const loserCell  = container.querySelector('tr[data-user-id="b"] [data-testid="player-name"]');
    expect(winnerCell?.textContent).toContain("👑");
    expect(winnerCell?.textContent).toContain("Carlos");
    expect(loserCell?.textContent).not.toContain("👑");
    expect(loserCell?.textContent).toContain("Erik");
  });

  it("row con games_played=0 tiene clase opacity-45", () => {
    const rows = [
      row({ user_id: "a", display_name: "Carlos" }),
      row({ user_id: "b", username: "erik", display_name: "Erik", games_played: 0, total_points: 0, wins: 0, losses: 0, win_pct: 0, current_streak: "—" }),
    ];
    const { container } = render(<DailyLeaderboard rows={rows} currentUserId="a" />);
    const erikRow = container.querySelector('tr[data-user-id="b"]');
    expect(erikRow?.className).toContain("opacity-45");
    const carlosRow = container.querySelector('tr[data-user-id="a"]');
    expect(carlosRow?.className ?? "").not.toContain("opacity-45");
  });

  it("streak chip: 'W' usa primary, 'L' usa danger, '—' sin chip", () => {
    const rows = [
      row({ user_id: "a", current_streak: "3W" }),
      row({ user_id: "b", username: "erik", display_name: "Erik", current_streak: "1L" }),
      row({ user_id: "c", username: "gibbon", display_name: "Gibbon", current_streak: "—", games_played: 0 }),
    ];
    const { container } = render(<DailyLeaderboard rows={rows} currentUserId="a" />);
    const carlosStreak = container.querySelector('tr[data-user-id="a"] td:last-child span');
    const erikStreak   = container.querySelector('tr[data-user-id="b"] td:last-child span');
    const gibbonStreak = container.querySelector('tr[data-user-id="c"] td:last-child span');

    expect(carlosStreak?.textContent).toBe("3W");
    expect(carlosStreak?.className).toContain("text-primary");

    expect(erikStreak?.textContent).toBe("1L");
    expect(erikStreak?.className).toContain("text-danger");

    expect(gibbonStreak?.textContent).toBe("—");
    expect(gibbonStreak?.className).toContain("text-text-dim");
  });

  it("highlight de currentUserId aplica bg-primary/5", () => {
    const rows = [
      row({ user_id: "a", display_name: "Carlos" }),
      row({ user_id: "b", username: "erik", display_name: "Erik" }),
    ];
    const { container } = render(<DailyLeaderboard rows={rows} currentUserId="a" />);
    const carlosRow = container.querySelector('tr[data-user-id="a"]');
    const erikRow   = container.querySelector('tr[data-user-id="b"]');
    expect(carlosRow?.className).toContain("bg-primary/5");
    expect(erikRow?.className ?? "").not.toContain("bg-primary/5");
  });

  it("muestra el % cuando games_played>0 y '—' cuando games_played=0", () => {
    const rows = [
      row({ user_id: "a", win_pct: 67 }),
      row({ user_id: "b", username: "erik", display_name: "Erik", games_played: 0, total_points: 0, wins: 0, losses: 0, win_pct: 0, current_streak: "—" }),
    ];
    const { container } = render(<DailyLeaderboard rows={rows} currentUserId="a" />);
    const carlosPctCell = container.querySelectorAll('tr[data-user-id="a"] td')[5];
    const erikPctCell   = container.querySelectorAll('tr[data-user-id="b"] td')[5];
    expect(carlosPctCell?.textContent).toBe("67%");
    expect(erikPctCell?.textContent).toBe("—");
  });
});
