/**
 * Component tests for ModalityChips (F1.8 smoke).
 * Run: pnpm vitest run src/components/tournament-wizard/__tests__/ModalityChips.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ModalityChips } from "../ModalityChips";

afterEach(() => {
  cleanup();
});

describe("ModalityChips", () => {
  it("renderiza chips para VE / DO / CU / PR / Custom", () => {
    render(<ModalityChips value="ven" onChange={() => {}} />);
    expect(screen.getByText("VE")).toBeDefined();
    expect(screen.getByText("DO")).toBeDefined();
    expect(screen.getByText("CU")).toBeDefined();
    expect(screen.getByText("PR")).toBeDefined();
    expect(screen.getByText("Custom")).toBeDefined();
  });

  it("renderiza 5 radios", () => {
    render(<ModalityChips value="ven" onChange={() => {}} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("click en chip invoca onChange con el modality key correcto", () => {
    const onChange = vi.fn();
    render(<ModalityChips value="ven" onChange={onChange} />);

    fireEvent.click(screen.getByText("DO"));
    expect(onChange).toHaveBeenCalledWith("dom");

    fireEvent.click(screen.getByText("CU"));
    expect(onChange).toHaveBeenCalledWith("cub");

    fireEvent.click(screen.getByText("PR"));
    expect(onChange).toHaveBeenCalledWith("pri");

    fireEvent.click(screen.getByText("Custom"));
    expect(onChange).toHaveBeenCalledWith("custom");
  });

  it("el chip seleccionado tiene aria-checked=true y clase visual distinta", () => {
    const { container } = render(
      <ModalityChips value="dom" onChange={() => {}} />,
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
    expect(selected?.className).toMatch(/primary/);
    expect(notSelected?.className).not.toMatch(/border-primary/);
  });
});
