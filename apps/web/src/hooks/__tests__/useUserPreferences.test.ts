/**
 * Unit tests for useUserPreferences hook.
 * Run: pnpm vitest run src/hooks/__tests__/useUserPreferences.test.ts
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUserPreferences } from "../useUserPreferences";
import type { UserPreferences } from "@/types/user-preferences";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetUserPreferences = vi.fn();
const mockUpdateUserPreferences = vi.fn();

vi.mock("@/lib/user-preferences-actions", () => ({
  getUserPreferences: () => mockGetUserPreferences(),
  updateUserPreferences: (input: unknown) => mockUpdateUserPreferences(input),
}));

const SAMPLE_PREFERENCES: UserPreferences = {
  user_id: "user-123",
  default_match_modality: "ven",
  default_count_rule: "rival",
  default_set_size: "d6",
  default_target_points: 100,
  default_capicua_bonus: 30,
  skip_modality_prompt: false,
  notification_settings: {},
  theme: "dark",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useUserPreferences — fetch on mount", () => {
  it("starts with loading=true and preferences=null when no initialPreferences", async () => {
    // Arrange: resolve after render so we can catch the initial state
    let resolveFetch!: (v: UserPreferences) => void;
    mockGetUserPreferences.mockReturnValue(
      new Promise<UserPreferences>((r) => {
        resolveFetch = r;
      }),
    );

    // Act
    const { result } = renderHook(() => useUserPreferences());

    // Assert initial state
    expect(result.current.loading).toBe(true);
    expect(result.current.preferences).toBeNull();

    // Resolve and wait for final state
    act(() => {
      resolveFetch(SAMPLE_PREFERENCES);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preferences).toEqual(SAMPLE_PREFERENCES);
  });

  it("resolves preferences correctly after successful fetch", async () => {
    mockGetUserPreferences.mockResolvedValue(SAMPLE_PREFERENCES);

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preferences).toEqual(SAMPLE_PREFERENCES);
    expect(mockGetUserPreferences).toHaveBeenCalledOnce();
  });

  it("falls back to default preferences when fetch returns null", async () => {
    mockGetUserPreferences.mockResolvedValue(null);

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preferences).not.toBeNull();
    expect(result.current.preferences?.skip_modality_prompt).toBe(false);
    expect(result.current.preferences?.default_match_modality).toBeNull();
  });

  it("falls back to default preferences when fetch throws", async () => {
    mockGetUserPreferences.mockRejectedValue(new Error("DB unavailable"));

    const { result } = renderHook(() => useUserPreferences());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.preferences).not.toBeNull();
    expect(result.current.preferences?.skip_modality_prompt).toBe(false);
  });
});

describe("useUserPreferences — initialPreferences prop", () => {
  it("skips fetch when initialPreferences are provided", () => {
    renderHook(() => useUserPreferences(SAMPLE_PREFERENCES));

    expect(mockGetUserPreferences).not.toHaveBeenCalled();
  });

  it("loading=false immediately when initialPreferences are provided", () => {
    const { result } = renderHook(() =>
      useUserPreferences(SAMPLE_PREFERENCES),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.preferences).toEqual(SAMPLE_PREFERENCES);
  });

  it("triggers fetch when initialPreferences=undefined (no prop passed)", async () => {
    mockGetUserPreferences.mockResolvedValue(SAMPLE_PREFERENCES);

    const { result } = renderHook(() => useUserPreferences(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetUserPreferences).toHaveBeenCalledOnce();
  });
});

describe("useUserPreferences — update()", () => {
  it("calls updateUserPreferences with the provided input", async () => {
    mockGetUserPreferences.mockResolvedValue(SAMPLE_PREFERENCES);
    const updatedPrefs: UserPreferences = {
      ...SAMPLE_PREFERENCES,
      skip_modality_prompt: true,
      default_match_modality: "dom",
    };
    mockUpdateUserPreferences.mockResolvedValue({ ok: true, data: updatedPrefs });

    const { result } = renderHook(() =>
      useUserPreferences(SAMPLE_PREFERENCES),
    );

    await act(async () => {
      await result.current.update({
        skip_modality_prompt: true,
        default_match_modality: "dom",
      });
    });

    expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
      skip_modality_prompt: true,
      default_match_modality: "dom",
    });
  });

  it("updates local state with returned data after successful update", async () => {
    const updatedPrefs: UserPreferences = {
      ...SAMPLE_PREFERENCES,
      skip_modality_prompt: true,
      default_match_modality: "dom",
    };
    mockUpdateUserPreferences.mockResolvedValue({ ok: true, data: updatedPrefs });

    const { result } = renderHook(() =>
      useUserPreferences(SAMPLE_PREFERENCES),
    );

    await act(async () => {
      await result.current.update({ skip_modality_prompt: true });
    });

    expect(result.current.preferences?.skip_modality_prompt).toBe(true);
    expect(result.current.preferences?.default_match_modality).toBe("dom");
  });

  it("does not crash when update fails", async () => {
    mockUpdateUserPreferences.mockResolvedValue({
      ok: false,
      error: "Rate limit exceeded",
    });

    const { result } = renderHook(() =>
      useUserPreferences(SAMPLE_PREFERENCES),
    );

    await expect(
      act(async () => {
        await result.current.update({ skip_modality_prompt: true });
      }),
    ).resolves.not.toThrow();

    // Preferences should remain unchanged
    expect(result.current.preferences).toEqual(SAMPLE_PREFERENCES);
  });
});
