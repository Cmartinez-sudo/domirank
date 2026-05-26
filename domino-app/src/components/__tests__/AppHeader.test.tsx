/**
 * Component tests for AppHeader.
 * Run: pnpm vitest run src/components/__tests__/AppHeader.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppHeader } from "../AppHeader";

// Mock useSafeBack to avoid router dependency in tests
vi.mock("@/hooks/useSafeBack", () => ({
  useSafeBack: (fallbackPath: string) => ({
    goBack: vi.fn(),
    fallbackPath,
  }),
}));

// Mock next/navigation (pulled in transitively)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

describe("AppHeader", () => {
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
