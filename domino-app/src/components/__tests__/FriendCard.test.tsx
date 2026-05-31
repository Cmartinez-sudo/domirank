/**
 * Component tests for FriendCard (inside FriendsPanel).
 * Verifies the entire card is a single <Link> with aria-label,
 * no nested interactive elements, and RatingBadge is a <span>.
 *
 * Run: pnpm vitest run src/components/__tests__/FriendCard.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FriendsPanel } from "@/app/friends/FriendsPanel";

// Stub next/link so it renders a plain <a>
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// Stub next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Stub Toast
vi.mock("@/components/Toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), show: vi.fn() }),
}));

// Stub Avatar to a simple img
vi.mock("@/components/Avatar", () => ({
  Avatar: ({ player }: { player: { username: string } }) => (
    <img alt={`avatar-${player.username}`} />
  ),
}));

// Stub UserSearch so it doesn't pull heavy deps
vi.mock("@/components/UserSearch", () => ({
  UserSearch: () => <div data-testid="user-search" />,
}));

// Stub PageTransition
vi.mock("@/components/Motion", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const FRIEND = {
  id: "user-abc",
  username: "pepe",
  display_name: "Pepe García",
  avatar_url: null,
  country: null,
  global_display: 8.5,
  total_games: 20,
  total_wins: 12,
  total_losses: 8,
  last_match_at: null,
};

function renderPanel() {
  return render(
    <FriendsPanel friends={[FRIEND]} incoming={[]} outgoing={[]} viewerMatchesCount={0} viewerActiveContinuousLeaguesCount={0} />
  );
}

describe("FriendCard", () => {
  it("renders an <a> wrapping the entire card with the correct aria-label", () => {
    const { container } = renderPanel();
    const link = container.querySelector(`a[href="/profile/pepe"]`);
    expect(link).not.toBeNull();
    expect(link!.getAttribute("aria-label")).toBe("Ver perfil de Pepe García");
  });

  it("does NOT contain any <button> elements inside the friend card link", () => {
    const { container } = renderPanel();
    const link = container.querySelector(`a[href="/profile/pepe"]`);
    expect(link).not.toBeNull();
    const buttons = link!.querySelectorAll("button");
    expect(buttons.length).toBe(0);
  });

  it("does NOT contain nested <a> elements inside the friend card link", () => {
    const { container } = renderPanel();
    const link = container.querySelector(`a[href="/profile/pepe"]`);
    expect(link).not.toBeNull();
    const nestedAnchors = link!.querySelectorAll("a");
    expect(nestedAnchors.length).toBe(0);
  });

  it("renders the RatingBadge as a <span> (not a <button>)", () => {
    const { container } = renderPanel();
    // The rating badge should be a span (no interactive role)
    const ratingBadge = container.querySelector(`a[href="/profile/pepe"] span[title]`);
    expect(ratingBadge).not.toBeNull();
    expect(ratingBadge!.tagName.toLowerCase()).toBe("span");
  });

  it("shows the friend display name and username inside the card", () => {
    const { container } = renderPanel();
    const link = container.querySelector(`a[href="/profile/pepe"]`);
    expect(link).not.toBeNull();
    expect(link!.textContent).toContain("Pepe García");
    expect(link!.textContent).toContain("@pepe");
  });
});
