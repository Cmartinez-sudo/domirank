/** @vitest-environment jsdom */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { WinnersHistorySection } from "../WinnersHistorySection";
import type { ContinuousLeagueWinnerHistoryRow } from "@/types/continuous-league";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    children, href, ...props
  }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => cleanup());

function winner(
  session_day: string,
  name: string,
  overrides: Partial<ContinuousLeagueWinnerHistoryRow> = {},
): ContinuousLeagueWinnerHistoryRow {
  return {
    session_day,
    winner_id:           `id-${session_day}`,
    winner_username:     name.toLowerCase(),
    winner_display_name: name,
    winner_avatar_url:   null,
    total_points:        200,
    matches_played:      3,
    ...overrides,
  };
}

describe("WinnersHistorySection", () => {
  it("winners=[] devuelve null (no renderiza nada)", () => {
    const { container } = render(
      <WinnersHistorySection tournamentId="t1" winners={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("con 3 winners muestra 3 filas con fecha + nombre + puntos + matches", () => {
    const winners = [
      winner("2026-05-30", "Carlos", { total_points: 250, matches_played: 4 }),
      winner("2026-05-29", "Erik",   { total_points: 180, matches_played: 3 }),
      winner("2026-05-28", "Gibbon", { total_points: 150, matches_played: 1 }),
    ];
    const { container } = render(
      <WinnersHistorySection tournamentId="t1" winners={winners} />,
    );
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(3);
    expect(container.textContent).toContain("Carlos");
    expect(container.textContent).toContain("Erik");
    expect(container.textContent).toContain("Gibbon");
    expect(container.textContent).toContain("250 pts");
    expect(container.textContent).toContain("4 partidas");
    expect(container.textContent).toContain("180 pts");
    expect(container.textContent).toContain("3 partidas");
    expect(container.textContent).toContain("150 pts");
    // matches_played=1 usa singular
    expect(container.textContent).toContain("1 partida");
  });

  it("con 12 winners muestra 10 filas + link 'Ver todo el histórico' disabled", () => {
    const winners = Array.from({ length: 12 }, (_, i) =>
      winner(`2026-05-${String(20 + i).padStart(2, "0")}`, `User${i}`),
    );
    const { container } = render(
      <WinnersHistorySection tournamentId="t1" winners={winners} />,
    );
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(10);

    const moreBtn = container.querySelector("button");
    expect(moreBtn).not.toBeNull();
    expect(moreBtn?.textContent).toContain("Ver todo el histórico");
    expect(moreBtn?.hasAttribute("disabled")).toBe(true);
  });

  it("con exactamente 10 winners NO muestra el link 'Ver todo'", () => {
    const winners = Array.from({ length: 10 }, (_, i) =>
      winner(`2026-05-${String(20 + i).padStart(2, "0")}`, `User${i}`),
    );
    const { container } = render(
      <WinnersHistorySection tournamentId="t1" winners={winners} />,
    );
    expect(container.querySelectorAll("li")).toHaveLength(10);
    expect(container.querySelector("button")).toBeNull();
  });

  it("fecha formato Spanish corto: 'sáb 30 may' para 2026-05-30", () => {
    const winners = [winner("2026-05-30", "Carlos")];
    const { container } = render(
      <WinnersHistorySection tournamentId="t1" winners={winners} />,
    );
    // toLocaleDateString("es", { weekday:"short", day:"2-digit", month:"short" })
    // en Node devuelve algo como "sáb, 30 may" o "sáb., 30 may" o "sáb 30 may"
    // según la versión de ICU. Validamos las partes claves: día, mes, weekday.
    const text = container.textContent ?? "";
    expect(text.toLowerCase()).toContain("sáb");
    expect(text).toContain("30");
    expect(text.toLowerCase()).toContain("may");
  });

  it("href de cada fila incluye el session_day como ?day=YYYY-MM-DD", () => {
    const winners = [winner("2026-05-30", "Carlos")];
    const { container } = render(
      <WinnersHistorySection tournamentId="t1" winners={winners} />,
    );
    const link = container.querySelector("li a");
    expect(link?.getAttribute("href")).toBe("/tournaments/t1?day=2026-05-30");
  });

  it("href preserva seasonParam cuando se pasa", () => {
    const winners = [winner("2026-05-30", "Carlos")];
    const { container } = render(
      <WinnersHistorySection tournamentId="t1" winners={winners} seasonParam={3} />,
    );
    const link = container.querySelector("li a");
    expect(link?.getAttribute("href")).toBe("/tournaments/t1?day=2026-05-30&season=3");
  });

  it("usa winner_username como fallback cuando display_name es null", () => {
    const winners = [winner("2026-05-30", "Carlos", {
      winner_display_name: null,
      winner_username:     "carlitos99",
    })];
    const { container } = render(
      <WinnersHistorySection tournamentId="t1" winners={winners} />,
    );
    expect(container.textContent).toContain("carlitos99");
  });
});
