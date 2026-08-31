/**
 * Component tests for NewMatchForm — Layout 2 (count_rule + presets).
 * Cover skip flow, "save as default" checkbox y el badge "Cambiar".
 * Run: pnpm vitest run src/app/matches/new/__tests__/NewMatchForm.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
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

// next/image mock — vitest env doesn't ship SVG loader.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img alt="" {...props} />,
}));

const CURRENT_USER = {
  id: "user-001",
  username: "testplayer",
  display_name: "Test Player",
  avatar_url: null,
  country: "VE",
};

const PREFERENCES_SKIP_RAPIDO: UserPreferences = {
  user_id: "user-001",
  default_match_modality: "ven",
  default_count_rule: "rival",
  default_set_size: "d6",
  default_target_points: 100,
  default_capicua_bonus: 30,
  skip_modality_prompt: true,
  notification_settings: {},
  theme: "dark",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const PREFERENCES_NO_SKIP: UserPreferences = {
  ...PREFERENCES_SKIP_RAPIDO,
  skip_modality_prompt: false,
};

function renderForm(initialPreferences?: UserPreferences | null) {
  return render(
    <NewMatchForm
      currentUser={CURRENT_USER}
      defaultPreset="rapido"
      initialPreferences={initialPreferences}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockUpdateUserPreferences.mockResolvedValue({ ok: true, data: PREFERENCES_SKIP_RAPIDO });
});

afterEach(() => {
  cleanup();
});

// ── Tests: step de configuración (sin skip) ───────────────────────────────

describe("NewMatchForm — step config (sin skip)", () => {
  it("muestra 'Modalidad de juego' y las 2 tarjetas de count_rule", () => {
    renderForm(PREFERENCES_NO_SKIP);
    expect(screen.getByText(/Modalidad de juego/)).toBeDefined();
    expect(screen.getByTestId("count-rule-rival")).toBeDefined();
    expect(screen.getByTestId("count-rule-mesa")).toBeDefined();
  });

  it("muestra el toggle 'Guardar esta configuración como mi partida por defecto'", () => {
    renderForm(PREFERENCES_NO_SKIP);
    expect(
      screen.getByText(/Guardar esta configuración como mi partida por defecto/),
    ).toBeDefined();
  });

  it("checkbox 'Guardar como default' inicialmente desmarcado", () => {
    const { container } = renderForm(PREFERENCES_NO_SKIP);
    const checkbox = container.querySelector(
      "input[type='checkbox'].accent-primary",
    ) as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  it("marcar checkbox + Continuar llama updateUserPreferences con los 4 defaults + skip=true", async () => {
    const { container } = renderForm(PREFERENCES_NO_SKIP);

    const checkbox = container.querySelector(
      "input[type='checkbox'].accent-primary",
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    const continueBtn = screen.getByRole("button", { name: /^Continuar$/ });
    fireEvent.click(continueBtn);

    await waitFor(() => {
      expect(mockUpdateUserPreferences).toHaveBeenCalledWith({
        default_count_rule: "rival",
        default_set_size: "d6",
        default_target_points: 100,
        default_capicua_bonus: 30,
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

describe("NewMatchForm — skip flow (skip_modality_prompt=true + defaults)", () => {
  it("salta directamente al step de jugadores cuando skip=true y hay 4 defaults", () => {
    renderForm(PREFERENCES_SKIP_RAPIDO);

    // Step config NO debe estar visible
    expect(screen.queryByText(/Modalidad de juego/)).toBeNull();

    // Step de jugadores debe estar visible
    expect(
      screen.getByRole("button", { name: /iniciar partida/i }),
    ).toBeDefined();
  });

  it("muestra badge con count_rule + preset + target cuando se saltó el step", () => {
    renderForm(PREFERENCES_SKIP_RAPIDO);

    const badge = screen.getByTestId("modality-skip-badge");
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("Cuenta rival");
    expect(badge.textContent).toContain("Rápido");
    expect(badge.textContent).toContain("100 pts");

    const changeBtn = screen.getByTestId("change-modality-btn");
    expect(changeBtn).toBeDefined();
    expect(changeBtn.textContent).toContain("Cambiar");
  });

  it("click 'Cambiar' lleva de vuelta al step de configuración", () => {
    renderForm(PREFERENCES_SKIP_RAPIDO);

    fireEvent.click(screen.getByTestId("change-modality-btn"));

    expect(screen.getByText(/Modalidad de juego/)).toBeDefined();
  });

  it("el override via 'Cambiar' NO llama updateUserPreferences", () => {
    renderForm(PREFERENCES_SKIP_RAPIDO);

    fireEvent.click(screen.getByTestId("change-modality-btn"));

    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it("sin skip: el badge NO aparece al avanzar manualmente", async () => {
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
  it("trata como flow normal cuando skip=true pero faltan defaults nuevos", () => {
    const inconsistentPrefs: UserPreferences = {
      ...PREFERENCES_SKIP_RAPIDO,
      default_count_rule: null,
      default_match_modality: null,
      default_set_size: null,
      default_target_points: null,
      default_capicua_bonus: null,
    };

    renderForm(inconsistentPrefs);

    // Debe mostrar el step de configuración (flow normal)
    expect(screen.getByText(/Modalidad de juego/)).toBeDefined();
  });

  it("muestra step de configuración cuando initialPreferences=null (graceful fallback)", () => {
    renderForm(null);

    expect(screen.getByText(/Modalidad de juego/)).toBeDefined();
  });
});
