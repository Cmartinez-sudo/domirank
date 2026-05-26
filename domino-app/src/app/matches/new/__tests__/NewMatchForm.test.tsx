/**
 * Component tests for NewMatchForm — US-05 skip modality prompt.
 * Tests the checkbox + persist flow and the "Cambiar" override badge.
 * Run: pnpm vitest run src/app/matches/new/__tests__/NewMatchForm.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { NewMatchForm } from "../NewMatchForm";
import type { UserPreferences } from "@/types/user-preferences";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockGetUserPreferences = vi.fn();
const mockUpdateUserPreferences = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("@/lib/user-preferences-actions", () => ({
  getUserPreferences: () => mockGetUserPreferences(),
  updateUserPreferences: (input: unknown) => mockUpdateUserPreferences(input),
}));

vi.mock("@/lib/live-match", () => ({
  startLiveMatch: vi.fn().mockResolvedValue({ ok: true, match_id: "match-abc" }),
}));

vi.mock("@/lib/tournament-pairing-link", () => ({
  linkMatchToPairing: vi.fn(),
}));

vi.mock("@/components/Avatar", () => ({
  Avatar: () => <div data-testid="avatar" />,
}));

vi.mock("@/components/UserSearch", () => ({
  UserSearch: () => <div data-testid="user-search" />,
}));

vi.mock("@/components/RatingBadge", () => ({
  RatingBadge: () => <div data-testid="rating-badge" />,
}));

const CURRENT_USER = {
  id: "user-001",
  username: "testplayer",
  display_name: "Test Player",
  avatar_url: null,
  country: "VE",
};

const PREFERENCES_SKIP_VEN: UserPreferences = {
  user_id: "user-001",
  default_match_modality: "ven",
  skip_modality_prompt: true,
  notification_settings: {},
  theme: "dark",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PREFERENCES_NO_SKIP: UserPreferences = {
  ...PREFERENCES_SKIP_VEN,
  skip_modality_prompt: false,
};

function renderForm(initialPreferences?: UserPreferences | null) {
  return render(
    <NewMatchForm
      currentUser={CURRENT_USER}
      defaultModality="ven"
      initialPreferences={initialPreferences}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockUpdateUserPreferences.mockResolvedValue({ ok: true, data: PREFERENCES_SKIP_VEN });
});

afterEach(() => {
  cleanup();
});

// ── Tests: checkbox + persist ──────────────────────────────────────────────

describe("NewMatchForm — modalidad step (sin skip)", () => {
  it("muestra el step de modalidad cuando skip_modality_prompt=false", () => {
    renderForm(PREFERENCES_NO_SKIP);
    expect(screen.getByText(/Venezolano/)).toBeDefined();
    expect(screen.getByText(/No volver a preguntar esta modalidad/)).toBeDefined();
  });

  it("checkbox 'No volver a preguntar' inicialmente desmarcado", () => {
    const { container } = renderForm(PREFERENCES_NO_SKIP);
    // Use querySelector to get only the skip-checkbox (not the radio inputs)
    const checkbox = container.querySelector(
      "input[type='checkbox'].accent-primary",
    ) as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  it("marcar checkbox + Continuar llama updateUserPreferences con modality + skip=true", async () => {
    const { container } = renderForm(PREFERENCES_NO_SKIP);

    const checkbox = container.querySelector(
      "input[type='checkbox'].accent-primary",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    const continueBtn = screen.getByRole("button", { name: /^Continuar$/ });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        default_match_modality: "ven",
        skip_modality_prompt: true,
      });
    });
  });

  it("sin checkbox marcado + Continuar NO llama updateUserPreferences", async () => {
    renderForm(PREFERENCES_NO_SKIP);

    const continueBtn = screen.getByRole("button", { name: /^Continuar$/ });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
    });
  });

  it("avanza al step de jugadores después de Continuar", async () => {
    renderForm(PREFERENCES_NO_SKIP);

    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /iniciar partida/i }),
      ).toBeDefined();
    });
  });
});

// ── Tests: skip flow + badge ───────────────────────────────────────────────

describe("NewMatchForm — skip modality flow (skip_modality_prompt=true)", () => {
  it("salta directamente al step de jugadores cuando skip=true", () => {
    renderForm(PREFERENCES_SKIP_VEN);

    // Step de modalidad NO debe estar visible
    expect(screen.queryByText(/No volver a preguntar esta modalidad/)).toBeNull();

    // Step de jugadores debe estar visible
    expect(
      screen.getByRole("button", { name: /iniciar partida/i }),
    ).toBeDefined();
  });

  it("muestra badge 'Modalidad: Venezolano · Cambiar' cuando se saltó el step", () => {
    renderForm(PREFERENCES_SKIP_VEN);

    const badge = screen.getByTestId("modality-skip-badge");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("Venezolano");

    const changeBtn = screen.getByTestId("change-modality-btn");
    expect(changeBtn).toBeDefined();
    expect(changeBtn.textContent).toContain("Cambiar");
  });

  it("click 'Cambiar' lleva de vuelta al step de modalidad", () => {
    renderForm(PREFERENCES_SKIP_VEN);

    fireEvent.click(screen.getByTestId("change-modality-btn"));

    expect(
      screen.getByText(/No volver a preguntar esta modalidad/),
    ).toBeDefined();
  });

  it("el override via 'Cambiar' NO llama updateUserPreferences", () => {
    renderForm(PREFERENCES_SKIP_VEN);

    fireEvent.click(screen.getByTestId("change-modality-btn"));

    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it("sin skip: el badge 'Cambiar' NO aparece al avanzar manualmente", async () => {
    renderForm(PREFERENCES_NO_SKIP);

    fireEvent.click(screen.getByRole("button", { name: /^Continuar$/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /iniciar partida/i }),
      ).toBeDefined();
    });

    expect(screen.queryByTestId("modality-skip-badge")).toBeNull();
  });
});

// ── Tests: edge case estado inconsistente ──────────────────────────────────

describe("NewMatchForm — edge case: estado inconsistente", () => {
  it("trata como flow normal cuando skip=true pero default_modality=null", () => {
    const inconsistentPrefs: UserPreferences = {
      ...PREFERENCES_SKIP_VEN,
      default_match_modality: null,
    };

    renderForm(inconsistentPrefs);

    // Debe mostrar el step de modalidad (flow normal)
    expect(
      screen.getByText(/No volver a preguntar esta modalidad/),
    ).toBeDefined();
  });

  it("muestra step de modalidad cuando initialPreferences=null (graceful fallback)", () => {
    renderForm(null);

    // Flow normal: step de modalidad visible
    expect(screen.getByText(/Venezolano/)).toBeDefined();
  });
});
