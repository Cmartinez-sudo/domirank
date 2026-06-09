/**
 * HandRow component tests — Spec C4 acceptance criteria.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { HandRow, type HandRowData } from "@/components/match/HandRow";

afterEach(cleanup);

const baseHand: HandRowData = {
  id: 1,
  round_number: 3,
  team: 1,
  points: 30,
  kind: "points",
  recorded_at: new Date().toISOString(),
  recorded_by: { username: "alice", display_name: "Alice", avatar_url: null },
  last_edited_at: null,
  last_edited_by: null,
  edit_count: 0,
  attestation_status: null,
};

describe("HandRow — default (no edits, no attestation)", () => {
  it("renderiza #N, team, +points sin atribución visible", () => {
    render(<HandRow hand={baseHand} nameA="Carlos" nameB="Erik" />);
    expect(screen.getByText("#3")).toBeTruthy();
    expect(screen.getByText("Carlos")).toBeTruthy();
    expect(screen.getByText("+30")).toBeTruthy();
    expect(screen.queryByText("Registrada por")).toBeNull();
  });

  it("tap expande la atribución", () => {
    render(<HandRow hand={baseHand} nameA="Carlos" nameB="Erik" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Registrada por")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("tap de nuevo colapsa", () => {
    render(<HandRow hand={baseHand} nameA="Carlos" nameB="Erik" />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText("Registrada por")).toBeNull();
  });
});

describe("HandRow — edited", () => {
  const editedHand: HandRowData = {
    ...baseHand,
    edit_count: 1,
    last_edited_at: new Date().toISOString(),
    last_edited_by: { username: "bob", display_name: "Bob", avatar_url: null },
  };

  it("muestra icon ámbar en la row colapsada", () => {
    render(<HandRow hand={editedHand} nameA="A" nameB="B" />);
    const editedMark = screen.getByLabelText("Mano editada");
    expect(editedMark).toBeTruthy();
  });

  it("expandido: muestra ambas atribuciones — registrada y editada", () => {
    render(<HandRow hand={editedHand} nameA="A" nameB="B" />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Registrada por")).toBeTruthy();
    expect(screen.getByText("Editada por")).toBeTruthy();
  });
});

describe("HandRow — attestation pending", () => {
  it("muestra badge 'Pendiente' en la row colapsada", () => {
    const pendingHand: HandRowData = {
      ...baseHand,
      attestation_status: "pending",
    };
    render(<HandRow hand={pendingHand} nameA="A" nameB="B" />);
    expect(screen.getByText("Pendiente")).toBeTruthy();
  });
});

describe("HandRow — tranque y capicúa", () => {
  it("kind=tranque muestra '—' en lugar de '+0'", () => {
    const hand: HandRowData = { ...baseHand, kind: "tranque", points: 0 };
    render(<HandRow hand={hand} nameA="A" nameB="B" />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("kind=capicua añade label 'capicúa'", () => {
    const hand: HandRowData = { ...baseHand, kind: "capicua" };
    render(<HandRow hand={hand} nameA="A" nameB="B" />);
    expect(screen.getByText("capicúa")).toBeTruthy();
  });
});

describe("HandRow — canEdit toggle", () => {
  const onEdit = vi.fn();
  it("canEdit=false NO muestra botón Editar (espectador)", () => {
    render(<HandRow hand={baseHand} nameA="A" nameB="B" canEdit={false} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText(/Editar mano/)).toBeNull();
  });

  it("canEdit=true + onEdit muestra link Editar", () => {
    render(<HandRow hand={baseHand} nameA="A" nameB="B" canEdit onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/Editar mano/)).toBeTruthy();
  });
});
