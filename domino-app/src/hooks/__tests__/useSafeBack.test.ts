/**
 * Unit tests for useSafeBack hook.
 * Run: pnpm vitest run src/hooks/__tests__/useSafeBack.test.ts
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSafeBack } from "../useSafeBack";

// Mock next/navigation
const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

describe("useSafeBack", () => {
  const FALLBACK = "/friends";

  beforeEach(() => {
    vi.resetAllMocks();
    // Ensure window is defined (jsdom environment)
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls router.back() when referrer is from the same origin", () => {
    Object.defineProperty(document, "referrer", {
      value: "http://localhost:3000/friends",
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSafeBack(FALLBACK));

    act(() => {
      result.current.goBack();
    });

    expect(mockBack).toHaveBeenCalledOnce();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("calls router.push(fallbackPath) when referrer is empty (deep-link)", () => {
    Object.defineProperty(document, "referrer", {
      value: "",
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSafeBack(FALLBACK));

    act(() => {
      result.current.goBack();
    });

    expect(mockPush).toHaveBeenCalledWith(FALLBACK);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("calls router.push(fallbackPath) when referrer is from a different origin", () => {
    Object.defineProperty(document, "referrer", {
      value: "https://google.com/search?q=domirank",
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useSafeBack(FALLBACK));

    act(() => {
      result.current.goBack();
    });

    expect(mockPush).toHaveBeenCalledWith(FALLBACK);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("returns the fallbackPath in the result", () => {
    const { result } = renderHook(() => useSafeBack(FALLBACK));
    expect(result.current.fallbackPath).toBe(FALLBACK);
  });
});
