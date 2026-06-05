/**
 * Smart redirect logic tests — Spec C7 acceptance criteria.
 *
 * Verifica las reglas de `shouldSkipRedirect` que viven internas en
 * ActiveMatchRedirect.tsx. Como están encapsuladas en el module, las
 * testeamos via behavioral assertions sobre el module exportado.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// Mock the realtime hook to control what activeMatch is returned.
const mockActiveMatch = vi.fn();
vi.mock("@/hooks/useActiveMatch", () => ({
  useActiveMatch: () => ({
    activeMatch: mockActiveMatch(),
    scoreA: 0,
    scoreB: 0,
    loading: false,
    refetch: vi.fn(),
  }),
}));

// Mock next/navigation
const mockReplace = vi.fn();
const mockPathname = vi.fn(() => "/");
const mockSearch = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => mockPathname(),
  useSearchParams: () => mockSearch(),
}));

import { ActiveMatchRedirect } from "@/components/match/ActiveMatchRedirect";

const ACTIVE_MATCH = {
  match_id: "abc123",
  status: "in_progress" as const,
  format: "doubles",
  target_points: 100,
  created_at: new Date().toISOString(),
  created_by: "user-x",
  current_score_keeper_id: null,
  tournament_id: null,
};

afterEach(() => {
  cleanup();
  mockReplace.mockReset();
  sessionStorage.clear();
});

describe("ActiveMatchRedirect — smart redirect rules", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/dashboard");
    mockSearch.mockReturnValue(new URLSearchParams());
    mockActiveMatch.mockReturnValue(ACTIVE_MATCH);
  });

  it("redirige a /matches/[id]/live la primera vez en una sesión", () => {
    render(<ActiveMatchRedirect userId="user-1" />);
    expect(mockReplace).toHaveBeenCalledWith("/matches/abc123/live");
  });

  it("NO re-redirect en la misma sesión (sessionStorage flag)", () => {
    sessionStorage.setItem("active-match-redirected:abc123", "1");
    render(<ActiveMatchRedirect userId="user-1" />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("NO redirige cuando el viewer ya está en alguna /matches/* route", () => {
    mockPathname.mockReturnValue("/matches/some-other-id");
    render(<ActiveMatchRedirect userId="user-1" />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("NO redirige en /onboarding", () => {
    mockPathname.mockReturnValue("/onboarding");
    render(<ActiveMatchRedirect userId="user-1" />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("NO redirige en /login, /signup, /reset-password, /forgot-password, /auth/*", () => {
    for (const path of ["/login", "/signup", "/reset-password", "/forgot-password", "/auth/callback"]) {
      cleanup();
      mockReplace.mockReset();
      mockPathname.mockReturnValue(path);
      render(<ActiveMatchRedirect userId="user-1" />);
      expect(mockReplace).not.toHaveBeenCalled();
    }
  });

  it("NO redirige cuando query string tiene ?from=*", () => {
    mockSearch.mockReturnValue(new URLSearchParams("?from=external"));
    render(<ActiveMatchRedirect userId="user-1" />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("NO redirige si no hay activeMatch (spectator path)", () => {
    mockActiveMatch.mockReturnValue(null);
    render(<ActiveMatchRedirect userId="user-1" />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("NO redirige cuando userId es null (no auth)", () => {
    render(<ActiveMatchRedirect userId={null} />);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("setea el flag sessionStorage al disparar el redirect", () => {
    render(<ActiveMatchRedirect userId="user-1" />);
    expect(sessionStorage.getItem("active-match-redirected:abc123")).toBe("1");
  });
});
