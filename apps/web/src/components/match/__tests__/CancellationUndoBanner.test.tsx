/**
 * UndoBanner UI logic — Spec MC4 acceptance criteria.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { CancellationUndoBanner } from "@/components/match/CancellationUndoBanner";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/live-match", () => ({
  undoMatchCancellation: vi.fn(async () => ({ ok: true as const })),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const CANCELLED_BY = { username: "carlos", display_name: "Carlos" };

describe("CancellationUndoBanner — warning variant (within undo window)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T12:00:00Z"));
  });

  it("muestra countdown live cuando viewer es participant + ventana abierta", () => {
    const undoUntil = new Date("2026-06-06T12:04:30Z").toISOString(); // 4:30 left
    render(
      <CancellationUndoBanner
        matchId="m1"
        undoUntilIso={undoUntil}
        cancelledBy={CANCELLED_BY}
        cancelledAtIso="2026-06-06T11:59:30Z"
        reason="user_cancelled"
        canUndo={true}
      />
    );
    expect(screen.getByText(/Carlos canceló esta partida/)).toBeTruthy();
    expect(screen.getByText("04:30")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Revertir/i })).toBeTruthy();
  });

  it("tick: countdown decrementa cada segundo", () => {
    const undoUntil = new Date("2026-06-06T12:00:10Z").toISOString(); // 10s
    render(
      <CancellationUndoBanner
        matchId="m1"
        undoUntilIso={undoUntil}
        cancelledBy={CANCELLED_BY}
        cancelledAtIso="2026-06-06T11:55:00Z"
        reason="user_cancelled"
        canUndo={true}
      />
    );
    expect(screen.getByText("00:10")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByText("00:07")).toBeTruthy();
  });

  it("expira: switchea a variante muted al llegar a 0", () => {
    const undoUntil = new Date("2026-06-06T12:00:02Z").toISOString(); // 2s
    render(
      <CancellationUndoBanner
        matchId="m1"
        undoUntilIso={undoUntil}
        cancelledBy={CANCELLED_BY}
        cancelledAtIso="2026-06-06T11:55:00Z"
        reason="user_cancelled"
        canUndo={true}
      />
    );
    expect(screen.getByRole("button", { name: /Revertir/i })).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3000); });
    // Banner switched to muted: no más botón
    expect(screen.queryByRole("button", { name: /Revertir/i })).toBeNull();
    expect(screen.getByText(/No afectó el rating/)).toBeTruthy();
  });
});

describe("CancellationUndoBanner — muted variant", () => {
  it("renderiza muted cuando undoUntilIso es null (sistémica)", () => {
    render(
      <CancellationUndoBanner
        matchId="m1"
        undoUntilIso={null}
        cancelledBy={null}
        cancelledAtIso="2026-06-06T11:55:00Z"
        reason="inactivity_auto"
        canUndo={true}
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/auto-cancelada por inactividad/)).toBeTruthy();
    expect(screen.getByText(/No afectó el rating/)).toBeTruthy();
  });

  it("renderiza muted cuando viewer NO es participant (canUndo=false)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T12:00:00Z"));
    const undoUntil = new Date("2026-06-06T12:04:30Z").toISOString();
    render(
      <CancellationUndoBanner
        matchId="m1"
        undoUntilIso={undoUntil}
        cancelledBy={CANCELLED_BY}
        cancelledAtIso="2026-06-06T11:55:00Z"
        reason="user_cancelled"
        canUndo={false}
      />
    );
    expect(screen.queryByRole("button", { name: /Revertir/i })).toBeNull();
    expect(screen.getByText(/Partida cancelada/)).toBeTruthy();
  });

  it("reason migration_cleanup → label correcto", () => {
    render(
      <CancellationUndoBanner
        matchId="m1"
        undoUntilIso={null}
        cancelledBy={null}
        cancelledAtIso="2026-06-06T11:00:00Z"
        reason="migration_cleanup"
        canUndo={false}
      />
    );
    expect(screen.getByText(/auto-cancelada \(limpieza\)/)).toBeTruthy();
  });

  it("reason replaced_by_new_match → label correcto", () => {
    render(
      <CancellationUndoBanner
        matchId="m1"
        undoUntilIso={null}
        cancelledBy={null}
        cancelledAtIso="2026-06-06T11:00:00Z"
        reason="replaced_by_new_match"
        canUndo={false}
      />
    );
    expect(screen.getByText(/reemplazada por partida nueva/)).toBeTruthy();
  });
});
