/**
 * Component tests for FormatPickerCards (F1.8 smoke).
 * Run: pnpm vitest run src/components/tournament-wizard/__tests__/FormatPickerCards.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FormatPickerCards } from "../FormatPickerCards";

afterEach(() => {
  cleanup();
});

describe("FormatPickerCards", () => {
  it("renderiza 3 cards (Suizo, Round Robin parejas, Eliminación directa) — sin Liga continua", () => {
    render(<FormatPickerCards value={undefined} onChange={() => {}} />);
    expect(screen.getByText("Suizo")).toBeDefined();
    expect(screen.getByText("Round Robin parejas")).toBeDefined();
    expect(screen.getByText("Eliminación directa")).toBeDefined();
    expect(screen.queryByText("Liga continua")).toBeNull();
  });

  it("renderiza 3 radios", () => {
    render(<FormatPickerCards value={undefined} onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("click en card invoca onChange con el format key correcto", () => {
    const onChange = vi.fn();
    render(<FormatPickerCards value={undefined} onChange={onChange} />);

    fireEvent.click(screen.getByText("Eliminación directa"));
    expect(onChange).toHaveBeenCalledWith("single_elim");

    fireEvent.click(screen.getByText("Suizo"));
    expect(onChange).toHaveBeenCalledWith("swiss");

    fireEvent.click(screen.getByText("Round Robin parejas"));
    expect(onChange).toHaveBeenCalledWith("round_robin");
  });

  it("la card seleccionada tiene aria-checked=true y clases visuales distintas", () => {
    const { container } = render(
      <FormatPickerCards value="swiss" onChange={() => {}} />,
    );

    const radios = container.querySelectorAll('[role="radio"]');
    const selected = Array.from(radios).find(
      (r) => r.getAttribute("aria-checked") === "true",
    );
    const notSelected = Array.from(radios).find(
      (r) => r.getAttribute("aria-checked") === "false",
    );

    expect(selected).toBeDefined();
    expect(notSelected).toBeDefined();
    // Selected debe tener clase visual de selección (border-primary o bg-primary)
    expect(selected?.className).toMatch(/primary/);
    // No-selected NO debe tener border-primary
    expect(notSelected?.className).not.toMatch(/border-primary/);
  });
});
