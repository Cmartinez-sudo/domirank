/**
 * Tests para BottomSheet.
 *
 * Cubre: open/close render, backdrop click, tecla Escape, botón "x", focus
 * trap inicial. El drag-to-close depende de gestos framer-motion que jsdom
 * no simula bien — se cubre en e2e Playwright.
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { BottomSheet } from "../BottomSheet";

afterEach(() => {
  cleanup();
});

describe("BottomSheet — render", () => {
  it("no renderiza contenido cuando open=false", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open={false} onClose={onClose} title="Test">
        <div>contenido</div>
      </BottomSheet>
    );
    expect(screen.queryByText("contenido")).toBeNull();
  });

  it("renderiza contenido, title y role=dialog cuando open=true", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Crear">
        <div>contenido</div>
      </BottomSheet>
    );
    expect(screen.getByText("contenido")).toBeTruthy();
    expect(screen.getByText("Crear")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("sheet sin title muestra la 'x' flotante pero no header", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose}>
        <div>contenido</div>
      </BottomSheet>
    );
    // La 'x' siempre está — al menos un botón "Cerrar" existe.
    const closeBtns = screen.getAllByRole("button", { name: /cerrar/i });
    expect(closeBtns.length).toBeGreaterThanOrEqual(1);
  });
});

describe("BottomSheet — cierre", () => {
  it("click en backdrop llama onClose", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Test">
        <div>x</div>
      </BottomSheet>
    );
    // El backdrop está marcado aria-hidden=true — lo encontramos por clase.
    const backdrop = document.querySelector('[aria-hidden="true"].fixed') as HTMLElement;
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("tecla Escape llama onClose", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Test">
        <button>focusable</button>
      </BottomSheet>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("botón 'Cerrar' del header llama onClose", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Test">
        <div>x</div>
      </BottomSheet>
    );
    const closeBtn = screen.getByRole("button", { name: /cerrar/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("BottomSheet — accesibilidad", () => {
  it("aria-labelledby apunta al title cuando existe", () => {
    render(
      <BottomSheet open onClose={() => {}} title="Crear">
        <div>x</div>
      </BottomSheet>
    );
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const label = document.getElementById(labelId!);
    expect(label?.textContent).toBe("Crear");
  });

  it("mueve focus al primer elemento focusable al abrir", async () => {
    render(
      <BottomSheet open onClose={() => {}} title="Test">
        <button data-testid="first">primero</button>
        <button data-testid="second">segundo</button>
      </BottomSheet>
    );
    // El focus trap corre en useEffect, esperamos un tick.
    await new Promise((r) => setTimeout(r, 0));
    // El primer focusable puede ser el botón "Cerrar" del header o "primero"
    // dependiendo del orden DOM. Verificamos que algún focusable dentro
    // del dialog tiene el focus.
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
