/**
 * Component tests for NROnboardingCard (sprint Reliability NR R3.4).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { NROnboardingCard } from "@/components/reliability/NROnboardingCard";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe("NROnboardingCard — progress states", () => {
  it("0 partidas: muestra '5 partidas confirmadas' faltantes", () => {
    render(<NROnboardingCard totalGames={0} />);
    expect(screen.getByText(/faltan 5/)).toBeTruthy();
    expect(screen.getByText("0 / 5")).toBeTruthy();
  });

  it("1 partida: singular 'partida confirmada'", () => {
    render(<NROnboardingCard totalGames={4} />);
    expect(screen.getByText(/faltan 1 partida confirmada/)).toBeTruthy();
    expect(screen.getByText("4 / 5")).toBeTruthy();
  });

  it("4 partidas → progressbar value=4, max=5", () => {
    render(<NROnboardingCard totalGames={4} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("4");
    expect(bar.getAttribute("aria-valuemax")).toBe("5");
  });

  it("totalGames > NR_THRESHOLD: clampea a 5/5 sin overflow", () => {
    render(<NROnboardingCard totalGames={20} />);
    expect(screen.getByText("5 / 5")).toBeTruthy();
    expect(screen.getByText(/Tu próxima partida confirmada activa/)).toBeTruthy();
  });

  it("renderiza link a /como-funciona", () => {
    const { container } = render(<NROnboardingCard totalGames={2} />);
    const link = container.querySelector('a[href="/como-funciona"]');
    expect(link).not.toBeNull();
  });

  it("titulo accesible via aria-labelledby", () => {
    const { container } = render(<NROnboardingCard totalGames={0} />);
    const section = container.querySelector("section[aria-labelledby='nr-onboarding-title']");
    expect(section).not.toBeNull();
    expect(screen.getByText("Calibrando tu rating")).toBeTruthy();
  });
});
