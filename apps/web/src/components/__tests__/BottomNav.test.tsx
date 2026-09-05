/**
 * Tests for the bottom nav rendered by AppShell (mobile).
 *
 * Nuevo layout: 5 celdas = Inicio · Ranking · Crear(+) · Grupos · Perfil.
 * Crear es un &lt;button&gt; que abre un BottomSheet; NO navega.
 * Perfil renderiza &lt;Avatar/&gt; sin label. Torneos ya no vive en el
 * bottom-nav (mudó al drawer).
 *
 * Run: pnpm vitest run src/components/__tests__/BottomNav.test.tsx
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { AppShell } from "../AppShell";

afterEach(() => cleanup());

// ---- dependency mocks ----

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/useActiveMatch", () => ({
  useActiveMatch: () => ({ activeMatch: null, scoreA: 0, scoreB: 0, loading: false, refetch: () => {} }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@/components/Avatar", () => ({
  Avatar: () => <span data-testid="avatar" />,
}));

vi.mock("@/components/NavigationLoader", () => ({
  NavigationLoader: () => null,
}));

vi.mock("@/components/RealtimeNotifications", () => ({
  RealtimeNotifications: () => null,
}));

vi.mock("@/components/NotificationBell", () => ({
  NotificationBell: () => <span data-testid="bell" />,
}));

// ---- helpers ----

const MOCK_USER = { id: "user-1" };
const MOCK_PROFILE = { username: "testuser", display_name: "Test User", avatar_url: null };

function renderShell(overrides?: Partial<Parameters<typeof AppShell>[0]>) {
  return render(
    <AppShell user={MOCK_USER} profile={MOCK_PROFILE} {...overrides}>
      <div>content</div>
    </AppShell>
  );
}

function getBottomNav(container: HTMLElement): HTMLElement {
  const navs = container.querySelectorAll("nav");
  return navs[navs.length - 1] as HTMLElement;
}

// ---- tests ----

describe("AppShell bottom nav — layout de 5 celdas", () => {
  it("renderiza 4 links + 1 botón (5 celdas totales)", () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    const links = bottomNav.querySelectorAll("a");
    const buttons = bottomNav.querySelectorAll("button");
    expect(links.length).toBe(4);
    expect(buttons.length).toBe(1);
  });

  it("los 4 links apuntan a Inicio·Ranking·Grupos·Perfil en orden", () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    const links = Array.from(bottomNav.querySelectorAll("a"));
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/dashboard", "/leaderboard", "/groups", "/profile"]);
  });

  it("Torneos NO está en el bottom-nav (mudó al drawer)", () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    const links = Array.from(bottomNav.querySelectorAll("a"));
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/tournaments");
  });

  it("Ranking usa PodiumIcon (3+ rects)", () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    const links = bottomNav.querySelectorAll("a");
    const rankingLink = links[1];
    expect(rankingLink.getAttribute("href")).toBe("/leaderboard");
    const rects = rankingLink.querySelectorAll("rect");
    expect(rects.length).toBeGreaterThanOrEqual(3);
  });

  it("Perfil renderiza Avatar (no icono genérico)", () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    const links = bottomNav.querySelectorAll("a");
    const perfilLink = links[3];
    expect(perfilLink.getAttribute("href")).toBe("/profile");
    const avatar = perfilLink.querySelector("[data-testid='avatar']");
    expect(avatar).not.toBeNull();
  });
});

describe("AppShell bottom nav — FAB Crear", () => {
  it("el botón central tiene aria-label='Crear', aria-haspopup='menu', aria-expanded='false' al inicio", () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    const btn = bottomNav.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute("aria-label")).toBe("Crear");
    expect(btn!.getAttribute("aria-haspopup")).toBe("menu");
    expect(btn!.getAttribute("aria-expanded")).toBe("false");
  });

  it("click en el botón Crear cambia aria-expanded a 'true' (abre el sheet)", () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    const btn = bottomNav.querySelector("button") as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("abrir el FAB revela las 3 acciones del CreateSheet", async () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    const btn = bottomNav.querySelector("button") as HTMLButtonElement;
    fireEvent.click(btn);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    const links = dialog.querySelectorAll("a");
    const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/matches/new");
    expect(hrefs).toContain("/tournaments/new");
    expect(hrefs).toContain("/groups/new");
  });

  it("el FAB NO tiene href (no navega)", () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    const btn = bottomNav.querySelector("button") as HTMLButtonElement;
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("href")).toBeNull();
  });
});

describe("AppShell bottom nav — snapshot", () => {
  it("matches snapshot del bottom nav", () => {
    const { container } = renderShell();
    const bottomNav = getBottomNav(container);
    expect(bottomNav).toMatchSnapshot();
  });
});
