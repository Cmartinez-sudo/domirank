/**
 * Component tests for PlayersCountStepper (F1.8 smoke).
 * Run: pnpm vitest run src/components/tournament-wizard/__tests__/PlayersCountStepper.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PlayersCountStepper } from "../PlayersCountStepper";

afterEach(() => {
  cleanup();
});

describe("PlayersCountStepper", () => {
  it("renderiza con valor inicial", () => {
    render(<PlayersCountStepper value={8} onChange={() => {}} />);
    expect(screen.getByText("8")).toBeDefined();
  });

  it("botón + incrementa", () => {
    const onChange = vi.fn();
    render(<PlayersCountStepper value={8} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Aumentar jugadores"));
    expect(onChange).toHaveBeenCalledWith(9);
  });

  it("botón - decrementa", () => {
    const onChange = vi.fn();
    render(<PlayersCountStepper value={8} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Disminuir jugadores"));
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("no baja del mínimo (4 por defecto): botón − queda disabled y no llama onChange", () => {
    const onChange = vi.fn();
    render(<PlayersCountStepper value={4} onChange={onChange} />);
    const dec = screen.getByLabelText("Disminuir jugadores") as HTMLButtonElement;
    expect(dec.disabled).toBe(true);
    fireEvent.click(dec);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("no sube del máximo (64 por defecto): botón + queda disabled y no llama onChange", () => {
    const onChange = vi.fn();
    render(<PlayersCountStepper value={64} onChange={onChange} />);
    const inc = screen.getByLabelText("Aumentar jugadores") as HTMLButtonElement;
    expect(inc.disabled).toBe(true);
    fireEvent.click(inc);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("respeta min/max custom", () => {
    const onChange = vi.fn();
    render(
      <PlayersCountStepper value={10} onChange={onChange} min={10} max={10} />,
    );
    const dec = screen.getByLabelText("Disminuir jugadores") as HTMLButtonElement;
    const inc = screen.getByLabelText("Aumentar jugadores") as HTMLButtonElement;
    expect(dec.disabled).toBe(true);
    expect(inc.disabled).toBe(true);
  });

  it("muestra error inline si se le pasa error", () => {
    render(
      <PlayersCountStepper
        value={5}
        onChange={() => {}}
        error="Round Robin requiere número par"
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Round Robin requiere número par",
    );
  });

  it("sin error no renderiza el role=alert", () => {
    render(<PlayersCountStepper value={8} onChange={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
