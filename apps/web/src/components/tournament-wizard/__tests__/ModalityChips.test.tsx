/**
 * Component tests for ModalityChips — Layout 2 (count_rule tiles + preset chips).
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

const baseProps = {
  countRule: "rival" as const,
  onCountRuleChange: () => {},
  preset: null as null | "rapido" | "clasico" | "mesa-completa",
  onPresetChange: () => {},
};

describe("ModalityChips — count_rule tiles", () => {
  it("renderiza las 2 tarjetas de count_rule", () => {
    render(<ModalityChips {...baseProps} />);
    expect(screen.getByTestId("count-rule-rival")).toBeDefined();
    expect(screen.getByTestId("count-rule-mesa")).toBeDefined();
  });

  it("aria-checked refleja countRule seleccionado", () => {
    render(<ModalityChips {...baseProps} countRule="mesa" />);
    expect(screen.getByTestId("count-rule-mesa").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("count-rule-rival").getAttribute("aria-checked")).toBe("false");
  });

  it("click en tile invoca onCountRuleChange", () => {
    const onCountRuleChange = vi.fn();
    render(<ModalityChips {...baseProps} onCountRuleChange={onCountRuleChange} />);
    fireEvent.click(screen.getByTestId("count-rule-mesa"));
    expect(onCountRuleChange).toHaveBeenCalledWith("mesa");
  });
});

describe("ModalityChips — preset chips filtrados", () => {
  it("countRule='rival' muestra chips Rápido + Clásico (sin Doble-9 retirado)", () => {
    render(<ModalityChips {...baseProps} countRule="rival" />);
    expect(screen.getByTestId("preset-rapido")).toBeDefined();
    expect(screen.getByTestId("preset-clasico")).toBeDefined();
    expect(screen.queryByTestId("preset-doble9")).toBeNull();
    expect(screen.queryByTestId("preset-mesa-completa")).toBeNull();
  });

  it("countRule='mesa' muestra sólo el chip Mesa completa", () => {
    render(<ModalityChips {...baseProps} countRule="mesa" />);
    expect(screen.getByTestId("preset-mesa-completa")).toBeDefined();
    expect(screen.queryByTestId("preset-rapido")).toBeNull();
    expect(screen.queryByTestId("preset-clasico")).toBeNull();
  });

  it("aria-checked del chip refleja preset seleccionado", () => {
    render(<ModalityChips {...baseProps} preset="clasico" />);
    expect(screen.getByTestId("preset-clasico").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("preset-rapido").getAttribute("aria-checked")).toBe("false");
  });

  it("click en chip invoca onPresetChange", () => {
    const onPresetChange = vi.fn();
    render(<ModalityChips {...baseProps} onPresetChange={onPresetChange} />);
    fireEvent.click(screen.getByTestId("preset-clasico"));
    expect(onPresetChange).toHaveBeenCalledWith("clasico");
  });
});
