/**
 * Component tests for GameConfigSection (Fase B).
 * Run: pnpm vitest run src/components/tournament-wizard/__tests__/GameConfigSection.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  GameConfigSection,
  defaultPointsForModality,
} from "../GameConfigSection";

afterEach(() => {
  cleanup();
});

const baseProps = {
  format: "swiss" as const,
  modality: "ven" as const,
  playerCount: 8,
  roundsCount: 5,
  onRoundsCountChange: () => {},
  timeLimitMinutes: 30 as number | null,
  onTimeLimitMinutesChange: () => {},
  pointsToWin: 100,
  onPointsToWinChange: () => {},
};

describe("GameConfigSection — rondas (solo Suizo)", () => {
  it("renderiza el stepper de rondas cuando format=swiss", () => {
    render(<GameConfigSection {...baseProps} format="swiss" />);
    expect(screen.getByText("Rondas de juego")).toBeDefined();
    expect(screen.getByLabelText("Aumentar rondas")).toBeDefined();
    expect(screen.getByLabelText("Disminuir rondas")).toBeDefined();
  });

  it("NO renderiza rondas cuando format=round_robin", () => {
    render(<GameConfigSection {...baseProps} format="round_robin" />);
    expect(screen.queryByText("Rondas de juego")).toBeNull();
  });

  it("NO renderiza rondas cuando format=single_elim", () => {
    render(<GameConfigSection {...baseProps} format="single_elim" />);
    expect(screen.queryByText("Rondas de juego")).toBeNull();
  });

  it("NO renderiza rondas cuando format=undefined", () => {
    render(<GameConfigSection {...baseProps} format={undefined} />);
    expect(screen.queryByText("Rondas de juego")).toBeNull();
  });

  it("clamp del stepper: no baja de 2", () => {
    const onChange = vi.fn();
    render(
      <GameConfigSection
        {...baseProps}
        roundsCount={2}
        onRoundsCountChange={onChange}
      />,
    );
    const dec = screen.getByLabelText("Disminuir rondas") as HTMLButtonElement;
    expect(dec.disabled).toBe(true);
  });

  it("clamp del stepper: no sube de 12", () => {
    const onChange = vi.fn();
    render(
      <GameConfigSection
        {...baseProps}
        roundsCount={12}
        onRoundsCountChange={onChange}
      />,
    );
    const inc = screen.getByLabelText("Aumentar rondas") as HTMLButtonElement;
    expect(inc.disabled).toBe(true);
  });

  it("helper text refleja repetición cuando rondas excede únicas", () => {
    // 8 jugadores = 4 parejas → 3 rondas únicas máx. roundsCount=5 → repetición.
    render(<GameConfigSection {...baseProps} playerCount={8} roundsCount={5} />);
    expect(screen.getByText(/repetición de enfrentamientos/)).toBeDefined();
  });
});

describe("GameConfigSection — tiempo por ronda", () => {
  it("renderiza los 5 presets de tiempo", () => {
    render(<GameConfigSection {...baseProps} />);
    expect(screen.getByText("Tiempo por ronda")).toBeDefined();
    expect(screen.getByText("Sin límite")).toBeDefined();
    expect(screen.getByText("15min")).toBeDefined();
    expect(screen.getByText("30min")).toBeDefined();
    expect(screen.getByText("45min")).toBeDefined();
    expect(screen.getByText("60min")).toBeDefined();
  });

  it("click en un preset invoca onChange con el valor correcto", () => {
    const onChange = vi.fn();
    render(
      <GameConfigSection
        {...baseProps}
        onTimeLimitMinutesChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("45min"));
    expect(onChange).toHaveBeenCalledWith(45);

    fireEvent.click(screen.getByText("Sin límite"));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("GameConfigSection — puntos a ganar", () => {
  it("renderiza los 5 chips de presets + Otro", () => {
    render(<GameConfigSection {...baseProps} />);
    expect(screen.getByText("Puntos a ganar")).toBeDefined();
    expect(screen.getByText("50")).toBeDefined();
    expect(screen.getByText("100")).toBeDefined();
    expect(screen.getByText("150")).toBeDefined();
    expect(screen.getByText("200")).toBeDefined();
    expect(screen.getByText("300")).toBeDefined();
    expect(screen.getByText("Otro")).toBeDefined();
  });

  it("click en preset invoca onChange con valor numérico", () => {
    const onChange = vi.fn();
    render(<GameConfigSection {...baseProps} onPointsToWinChange={onChange} />);
    fireEvent.click(screen.getByText("150"));
    expect(onChange).toHaveBeenCalledWith(150);
  });

  it("click en Otro abre el input numérico", () => {
    render(<GameConfigSection {...baseProps} />);
    expect(
      screen.queryByLabelText("Puntos a ganar personalizados"),
    ).toBeNull();
    fireEvent.click(screen.getByText("Otro"));
    expect(
      screen.getByLabelText("Puntos a ganar personalizados"),
    ).toBeDefined();
  });

  it("input personalizado clampa al rango 50-500", () => {
    const onChange = vi.fn();
    render(<GameConfigSection {...baseProps} onPointsToWinChange={onChange} />);
    fireEvent.click(screen.getByText("Otro"));
    const input = screen.getByLabelText(
      "Puntos a ganar personalizados",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1000" } });
    expect(onChange).toHaveBeenCalledWith(500);
    fireEvent.change(input, { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it("si pointsToWin no es un preset, abre Otro por default", () => {
    render(<GameConfigSection {...baseProps} pointsToWin={175} />);
    expect(
      screen.getByLabelText("Puntos a ganar personalizados"),
    ).toBeDefined();
  });
});

describe("defaultPointsForModality", () => {
  it("ven → 100, dom/cub/pri → 200, custom → 100", () => {
    expect(defaultPointsForModality("ven")).toBe(100);
    expect(defaultPointsForModality("dom")).toBe(200);
    expect(defaultPointsForModality("cub")).toBe(200);
    expect(defaultPointsForModality("pri")).toBe(200);
    expect(defaultPointsForModality("custom")).toBe(100);
  });
});
