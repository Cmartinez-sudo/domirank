/**
 * Component tests for AppHeader.
 * Cubre: render básico + regression test del modelo up-nav
 * (flecha atrás llama router.push(fallbackPath), NO router.back()).
 *
 * Run: pnpm vitest run src/components/__tests__/AppHeader.test.tsx
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AppHeader } from "../AppHeader";

// Mock next/navigation con spies para poder assert-ear qué llama la flecha.
const pushSpy = vi.fn();
const backSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (path: string) => pushSpy(path),
    back: () => backSpy(),
  }),
}));

afterEach(() => {
  cleanup();
  pushSpy.mockClear();
  backSpy.mockClear();
});

describe("AppHeader — render", () => {
  it("renders with aria-label='Volver' on the back button", () => {
    render(<AppHeader fallbackPath="/friends" />);
    const btn = screen.getByRole("button", { name: "Volver" });
    expect(btn).toBeDefined();
  });

  it("renders the title when provided", () => {
    render(<AppHeader title="Mi perfil" fallbackPath="/friends" />);
    expect(screen.getByText("Mi perfil")).toBeDefined();
  });

  it("renders the rightSlot when passed", () => {
    render(
      <AppHeader
        title="Torneo"
        fallbackPath="/tournaments"
        rightSlot={<button data-testid="action-btn">Editar</button>}
      />
    );
    expect(screen.getByTestId("action-btn")).toBeDefined();
  });

  it("matches snapshot for basic render", () => {
    const { container } = render(
      <AppHeader title="Detalle de partida" fallbackPath="/dashboard" />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("AppHeader — modelo up-nav (regression del bug torneo→home)", () => {
  it("click en la flecha llama router.push(fallbackPath), NO router.back()", () => {
    render(<AppHeader title="Torneo X" fallbackPath="/tournaments" />);
    const btn = screen.getByRole("button", { name: "Volver" });
    fireEvent.click(btn);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith("/tournaments");
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("bug reportado: entrando a un torneo desde /dashboard, la flecha va a /tournaments (NO a /dashboard)", () => {
    // Simulamos referrer de /dashboard — antes del fix, useSafeBack habría
    // llamado router.back() por el mismo origin, aterrizando en /dashboard.
    // Con up-nav, ignora el referrer y hace push al parent lógico declarado.
    Object.defineProperty(document, "referrer", {
      value: "http://localhost:3000/dashboard",
      configurable: true,
    });
    render(<AppHeader title="Torneo X" fallbackPath="/tournaments" />);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(pushSpy).toHaveBeenCalledWith("/tournaments");
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("prop deprecated forceFallback es no-op — no cambia comportamiento", () => {
    render(<AppHeader title="Torneo X" fallbackPath="/tournaments" forceFallback />);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(pushSpy).toHaveBeenCalledWith("/tournaments");
    // También sin forceFallback:
    pushSpy.mockClear();
    cleanup();
    render(<AppHeader title="Torneo X" fallbackPath="/tournaments" />);
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(pushSpy).toHaveBeenCalledWith("/tournaments");
  });
});
