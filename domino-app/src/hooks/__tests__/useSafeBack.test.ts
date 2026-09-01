/**
 * Unit tests for useSafeBack hook — modelo up-nav.
 *
 * Con el nuevo default (up-navigation), useSafeBack SIEMPRE llama a
 * router.push(fallbackPath), independientemente del referrer o del
 * historial. Nunca llama router.back().
 *
 * Ver docstring del hook y AppHeader.test.tsx (regression del bug
 * torneo → home).
 *
 * Run: pnpm vitest run src/hooks/__tests__/useSafeBack.test.ts
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSafeBack } from "../useSafeBack";

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

describe("useSafeBack — modelo up-navigation", () => {
  const FALLBACK = "/leaderboard";

  beforeEach(() => {
    vi.resetAllMocks();
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("SIEMPRE llama router.push(fallbackPath), NUNCA router.back() (referrer mismo-origen)", () => {
    Object.defineProperty(document, "referrer", {
      value: "http://localhost:3000/dashboard",
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useSafeBack(FALLBACK));
    act(() => { result.current.goBack(); });
    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith(FALLBACK);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("push al fallbackPath cuando referrer está vacío (deep-link)", () => {
    Object.defineProperty(document, "referrer", {
      value: "",
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useSafeBack(FALLBACK));
    act(() => { result.current.goBack(); });
    expect(mockPush).toHaveBeenCalledWith(FALLBACK);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("push al fallbackPath cuando referrer es de otro origin", () => {
    Object.defineProperty(document, "referrer", {
      value: "https://google.com/search?q=domirank",
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useSafeBack(FALLBACK));
    act(() => { result.current.goBack(); });
    expect(mockPush).toHaveBeenCalledWith(FALLBACK);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns el fallbackPath en el result", () => {
    const { result } = renderHook(() => useSafeBack(FALLBACK));
    expect(result.current.fallbackPath).toBe(FALLBACK);
  });

  it("prop deprecated forceFallback es no-op — con o sin ella se comporta igual", () => {
    Object.defineProperty(document, "referrer", {
      value: "http://localhost:3000/dashboard",
      writable: true,
      configurable: true,
    });
    const { result: withFlag } = renderHook(() =>
      useSafeBack(FALLBACK, { forceFallback: true }),
    );
    act(() => { withFlag.current.goBack(); });
    expect(mockPush).toHaveBeenCalledWith(FALLBACK);
    expect(mockBack).not.toHaveBeenCalled();

    mockPush.mockClear();
    const { result: noFlag } = renderHook(() => useSafeBack(FALLBACK));
    act(() => { noFlag.current.goBack(); });
    expect(mockPush).toHaveBeenCalledWith(FALLBACK);
    expect(mockBack).not.toHaveBeenCalled();
  });
});
