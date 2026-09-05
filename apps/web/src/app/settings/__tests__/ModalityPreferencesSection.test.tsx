/**
 * Component tests for ModalityPreferencesSection — US-06.
 *
 * NOTE: Requires migration 0034 (user_preferences table) in integration/e2e tests.
 * Unit tests here mock the hook and actions entirely.
 *
 * Run: pnpm vitest run src/app/settings/__tests__/ModalityPreferencesSection.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ModalityPreferencesSection } from "../ModalityPreferencesSection";
import type { UserPreferences } from "@/types/user-preferences";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: vi.fn(),
}));

vi.mock("@/components/Toast", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    show: vi.fn(),
    info: vi.fn(),
  }),
}));

import { useUserPreferences } from "@/hooks/useUserPreferences";

const BASE_PREFS: UserPreferences = {
  user_id: "user-001",
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

function mockHook(overrides: Partial<UserPreferences> = {}, loading = false) {
  (useUserPreferences as ReturnType<typeof vi.fn>).mockReturnValue({
    preferences: { ...BASE_PREFS, ...overrides },
    loading,
    update: mockUpdate,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockUpdate.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ModalityPreferencesSection — toggle ON (skip=false)", () => {
  it("renderiza la sección con el toggle ON cuando skip_modality_prompt=false", () => {
    mockHook({ skip_modality_prompt: false });
    render(<ModalityPreferencesSection />);

    expect(screen.getByText("Preferencias de partida")).toBeDefined();
    const toggle = screen.getByTestId("modality-prompt-toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("el dropdown NO aparece cuando toggle es ON", () => {
    mockHook({ skip_modality_prompt: false });
    render(<ModalityPreferencesSection />);

    expect(screen.queryByTestId("default-modality-select")).toBeNull();
  });

  it("click en el toggle llama update({ skip_modality_prompt: true })", async () => {
    mockHook({ skip_modality_prompt: false });
    render(<ModalityPreferencesSection />);

    const toggle = screen.getByTestId("modality-prompt-toggle");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ skip_modality_prompt: true });
    });
  });

  it("muestra toast de éxito después de toggle", async () => {
    mockHook({ skip_modality_prompt: false });
    render(<ModalityPreferencesSection />);

    fireEvent.click(screen.getByTestId("modality-prompt-toggle"));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Preferencias guardadas");
    });
  });
});

describe("ModalityPreferencesSection — toggle OFF (skip=true)", () => {
  it("renderiza el toggle OFF cuando skip_modality_prompt=true", () => {
    mockHook({ skip_modality_prompt: true, default_match_modality: "ven" });
    render(<ModalityPreferencesSection />);

    const toggle = screen.getByTestId("modality-prompt-toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("el dropdown aparece cuando toggle es OFF", () => {
    mockHook({ skip_modality_prompt: true, default_match_modality: "ven" });
    render(<ModalityPreferencesSection />);

    expect(screen.getByTestId("default-modality-select")).toBeDefined();
  });

  it("dropdown muestra el preset actual (Clásico) reconstruido de los 4 defaults", () => {
    mockHook({
      skip_modality_prompt: true,
      default_count_rule: "rival",
      default_set_size: "d6",
      default_target_points: 200,
      default_capicua_bonus: 30,
    });
    render(<ModalityPreferencesSection />);

    const select = screen.getByTestId("default-modality-select") as HTMLSelectElement;
    expect(select.value).toBe("clasico");
  });

  it("cambiar el dropdown a 'mesa-completa' llama update con los 4 defaults del preset", async () => {
    mockHook({
      skip_modality_prompt: true,
      default_count_rule: "rival",
      default_set_size: "d6",
      default_target_points: 100,
      default_capicua_bonus: 30,
    });
    render(<ModalityPreferencesSection />);

    const select = screen.getByTestId("default-modality-select");
    fireEvent.change(select, { target: { value: "mesa-completa" } });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        default_count_rule: "mesa",
        default_set_size: "d6",
        default_target_points: 200,
        default_capicua_bonus: 50,
      });
    });
  });

  it("click en toggle OFF→ON llama update({ skip_modality_prompt: false })", async () => {
    mockHook({ skip_modality_prompt: true, default_match_modality: "ven" });
    render(<ModalityPreferencesSection />);

    const toggle = screen.getByTestId("modality-prompt-toggle");
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ skip_modality_prompt: false });
    });
  });
});

describe("ModalityPreferencesSection — OFF sin defaults reconocibles", () => {
  it("muestra placeholder 'Elegir configuración...' cuando los 4 defaults no matchean ningún preset", () => {
    mockHook({
      skip_modality_prompt: true,
      default_count_rule: null,
      default_set_size: null,
      default_target_points: null,
      default_capicua_bonus: null,
    });
    render(<ModalityPreferencesSection />);

    const select = screen.getByTestId("default-modality-select") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.getByText(/Elegir configuración/)).toBeDefined();
  });

  it("persiste skip=true aunque no haya defaults (llama update con skip=true)", async () => {
    mockHook({
      skip_modality_prompt: false,
      default_count_rule: null,
      default_set_size: null,
      default_target_points: null,
      default_capicua_bonus: null,
    });
    render(<ModalityPreferencesSection />);

    fireEvent.click(screen.getByTestId("modality-prompt-toggle"));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({ skip_modality_prompt: true });
    });
  });

  it("muestra aviso 'Elige una configuración' cuando OFF y sin defaults reconocibles", () => {
    mockHook({
      skip_modality_prompt: true,
      default_count_rule: null,
      default_set_size: null,
      default_target_points: null,
      default_capicua_bonus: null,
    });
    render(<ModalityPreferencesSection />);

    expect(screen.getByRole("alert")).toBeDefined();
  });
});

describe("ModalityPreferencesSection — estado de carga", () => {
  it("muestra skeleton cuando loading=true", () => {
    (useUserPreferences as ReturnType<typeof vi.fn>).mockReturnValue({
      preferences: null,
      loading: true,
      update: mockUpdate,
    });

    const { container } = render(<ModalityPreferencesSection />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByTestId("modality-prompt-toggle")).toBeNull();
  });
});
