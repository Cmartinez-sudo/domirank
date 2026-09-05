/**
 * Tests para HamburgerDrawer.
 * Cubre: card→/profile, Torneos con badge beta, ítem Admin condicional.
 *
 * @vitest-environment jsdom
 */

import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HamburgerDrawer } from "../HamburgerDrawer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@/components/Avatar", () => ({
  Avatar: () => <span data-testid="avatar" />,
}));

const PROFILE = {
  id: "u1",
  username: "carlos",
  display_name: "Carlos",
  avatar_url: null,
  is_rated: true,
  global_display: 1200,
  global_elo: 1200,
};

afterEach(() => cleanup());

describe("HamburgerDrawer — card del perfil", () => {
  it("no renderiza si open=false", () => {
    render(<HamburgerDrawer open={false} onClose={() => {}} profile={PROFILE} />);
    expect(screen.queryByText("Carlos")).toBeNull();
  });

  it("la card lleva a /profile (no a /settings)", () => {
    const { container } = render(
      <HamburgerDrawer open onClose={() => {}} profile={PROFILE} />
    );
    // La card es el primer link del drawer (contiene el nombre del usuario)
    const links = Array.from(container.querySelectorAll("a"));
    const cardLink = links.find((a) => a.textContent?.includes("Carlos"));
    expect(cardLink).toBeTruthy();
    expect(cardLink!.getAttribute("href")).toBe("/profile");
  });
});

describe("HamburgerDrawer — ítem Torneos", () => {
  it("aparece como ítem del drawer con badge 'beta'", () => {
    const { container } = render(
      <HamburgerDrawer open onClose={() => {}} profile={PROFILE} />
    );
    const links = Array.from(container.querySelectorAll("a"));
    const torneos = links.find((a) => a.getAttribute("href") === "/tournaments");
    expect(torneos).toBeTruthy();
    expect(torneos!.textContent).toContain("Torneos");
    expect(torneos!.textContent?.toLowerCase()).toContain("beta");
  });
});

describe("HamburgerDrawer — ítem Administrar club/org (condicional)", () => {
  it("NO se muestra si adminOrgs está vacío", () => {
    render(<HamburgerDrawer open onClose={() => {}} profile={PROFILE} adminOrgs={[]} />);
    expect(screen.queryByText(/administrar club/i)).toBeNull();
  });

  it("NO se muestra si adminOrgs es undefined (default)", () => {
    render(<HamburgerDrawer open onClose={() => {}} profile={PROFILE} />);
    expect(screen.queryByText(/administrar club/i)).toBeNull();
  });

  it("apunta a /admin/org/{slug} cuando hay exactamente 1 org", () => {
    const { container } = render(
      <HamburgerDrawer
        open
        onClose={() => {}}
        profile={PROFILE}
        adminOrgs={[{ slug: "mi-club", name: "Mi Club" }]}
      />
    );
    const links = Array.from(container.querySelectorAll("a"));
    const admin = links.find((a) => a.textContent?.toLowerCase().includes("administrar"));
    expect(admin).toBeTruthy();
    expect(admin!.getAttribute("href")).toBe("/admin/org/mi-club");
  });

  it("apunta a /admin (picker) cuando hay 2+ orgs", () => {
    const { container } = render(
      <HamburgerDrawer
        open
        onClose={() => {}}
        profile={PROFILE}
        adminOrgs={[
          { slug: "club-a", name: "Club A" },
          { slug: "club-b", name: "Club B" },
        ]}
      />
    );
    const links = Array.from(container.querySelectorAll("a"));
    const admin = links.find((a) => a.textContent?.toLowerCase().includes("administrar"));
    expect(admin).toBeTruthy();
    expect(admin!.getAttribute("href")).toBe("/admin");
  });
});

describe("HamburgerDrawer — items existentes preservados", () => {
  it("preserva Ajustes, Amigos, Cómo funciona, Cerrar sesión", () => {
    const { container } = render(
      <HamburgerDrawer open onClose={() => {}} profile={PROFILE} />
    );
    const links = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(links).toContain("/friends");
    expect(links).toContain("/como-funciona");
    expect(links).toContain("/settings");
    // Cerrar sesión es un submit inside a form
    expect(screen.getByText(/cerrar sesión/i)).toBeTruthy();
  });
});
