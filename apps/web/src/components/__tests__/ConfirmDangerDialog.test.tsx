/**
 * Tests para ConfirmDangerDialog (Fase C+D #4 dec. 13).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmDangerDialog } from "../ConfirmDangerDialog";

afterEach(() => {
  cleanup();
});

const DEFAULT_PROPS = {
  open: true,
  onClose: () => {},
  onConfirm: () => {},
  title: "¿Salir del grupo?",
  description: "Dejarás de ver el leaderboard.",
  confirmLabel: "Sí, salir",
};

describe("ConfirmDangerDialog", () => {
  it("no renderiza nada cuando open=false", () => {
    const { container } = render(
      <ConfirmDangerDialog {...DEFAULT_PROPS} open={false} />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renderiza title, description y ambos botones", () => {
    render(<ConfirmDangerDialog {...DEFAULT_PROPS} />);
    expect(screen.getByText("¿Salir del grupo?")).toBeDefined();
    expect(screen.getByText("Dejarás de ver el leaderboard.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Sí, salir" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDefined();
  });

  it("click en Cancelar invoca onClose", () => {
    const onClose = vi.fn();
    render(<ConfirmDangerDialog {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("click en Confirmar invoca onConfirm", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDangerDialog {...DEFAULT_PROPS} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Sí, salir" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("pending=true deshabilita ambos botones", () => {
    render(<ConfirmDangerDialog {...DEFAULT_PROPS} pending />);
    const cancelBtn = screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement;
    expect(cancelBtn.disabled).toBe(true);
    // El botón de confirmar muestra "..." cuando pending; sigue siendo un button.
    const buttons = screen.getAllByRole("button");
    expect(buttons.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it("cancelLabel custom se respeta", () => {
    render(<ConfirmDangerDialog {...DEFAULT_PROPS} cancelLabel="Volver" />);
    expect(screen.getByRole("button", { name: "Volver" })).toBeDefined();
  });

  it("a11y: dialog tiene role + labels correctos", () => {
    const { container } = render(<ConfirmDangerDialog {...DEFAULT_PROPS} />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("confirm-danger-title");
    expect(dialog?.getAttribute("aria-describedby")).toBe("confirm-danger-desc");
  });
});
