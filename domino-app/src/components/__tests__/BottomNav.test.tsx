/**
 * Snapshot test for the bottom nav rendered by AppShell.
 * Verifies that Ranking uses PodiumIcon and Torneos uses TrophyIcon.
 * Run: pnpm vitest run src/components/__tests__/BottomNav.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AppShell } from "../AppShell";

// ---- dependency mocks ----

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

// ---- tests ----

describe("AppShell bottom nav icons", () => {
  it("renders bottom nav with 5 items when user is logged in", () => {
    const { container } = render(
      <AppShell user={MOCK_USER} profile={MOCK_PROFILE}>
        <div>content</div>
      </AppShell>
    );
    // Bottom nav is the last <nav> element (mobile fixed nav)
    const navs = container.querySelectorAll("nav");
    const bottomNav = navs[navs.length - 1];
    const links = bottomNav.querySelectorAll("a");
    expect(links).toHaveLength(5);
  });

  it("Ranking nav item contains a podium SVG (rect elements for steps)", () => {
    const { container } = render(
      <AppShell user={MOCK_USER} profile={MOCK_PROFILE}>
        <div>content</div>
      </AppShell>
    );
    const navs = container.querySelectorAll("nav");
    const bottomNav = navs[navs.length - 1];
    // Ranking is the 2nd link (index 1)
    const rankingLink = bottomNav.querySelectorAll("a")[1];
    const rects = rankingLink.querySelectorAll("rect");
    // PodiumIcon has 3 rect elements for the podium steps
    expect(rects.length).toBeGreaterThanOrEqual(3);
  });

  it("Torneos nav item contains a trophy SVG (paths for cup body)", () => {
    const { container } = render(
      <AppShell user={MOCK_USER} profile={MOCK_PROFILE}>
        <div>content</div>
      </AppShell>
    );
    const navs = container.querySelectorAll("nav");
    const bottomNav = navs[navs.length - 1];
    // Torneos is the 4th link (index 3)
    const tourneosLink = bottomNav.querySelectorAll("a")[3];
    const paths = tourneosLink.querySelectorAll("path");
    // TrophyIcon has 6 path elements
    expect(paths.length).toBe(6);
  });

  it("both new icons have aria-hidden=true", () => {
    const { container } = render(
      <AppShell user={MOCK_USER} profile={MOCK_PROFILE}>
        <div>content</div>
      </AppShell>
    );
    const navs = container.querySelectorAll("nav");
    const bottomNav = navs[navs.length - 1];
    const links = bottomNav.querySelectorAll("a");

    const rankingSvg = links[1].querySelector("svg");
    const torneosSvg = links[3].querySelector("svg");

    expect(rankingSvg?.getAttribute("aria-hidden")).toBe("true");
    expect(torneosSvg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("matches snapshot of the bottom nav", () => {
    const { container } = render(
      <AppShell user={MOCK_USER} profile={MOCK_PROFILE}>
        <div>content</div>
      </AppShell>
    );
    const navs = container.querySelectorAll("nav");
    const bottomNav = navs[navs.length - 1];
    expect(bottomNav).toMatchSnapshot();
  });
});
