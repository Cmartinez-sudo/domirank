/** @vitest-environment jsdom */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DayWinnerBadge } from "../DayWinnerBadge";

afterEach(() => cleanup());

describe("DayWinnerBadge", () => {
  it("variant='compact' (default) renderiza solo 👑 con aria-label='Rey del día'", () => {
    const { container } = render(<DayWinnerBadge />);
    const span = container.querySelector("span");
    expect(span?.textContent?.trim()).toBe("👑");
    expect(span?.getAttribute("aria-label")).toBe("Rey del día");
    expect(span?.getAttribute("title")).toBe("Rey del día");
    // Sin label "Rey del día" visible (solo aria-label/title)
    expect(container.textContent?.includes("REY DEL DÍA")).toBe(false);
  });

  it("variant='compact' explícito se comporta igual que default", () => {
    const { container } = render(<DayWinnerBadge variant="compact" />);
    const span = container.querySelector("span");
    expect(span?.textContent?.trim()).toBe("👑");
    expect(span?.getAttribute("aria-label")).toBe("Rey del día");
  });

  it("variant='full' renderiza 👑 + label visible 'Rey del día'", () => {
    const { container } = render(<DayWinnerBadge variant="full" />);
    expect(container.textContent).toContain("👑");
    // Label visible (en uppercase via CSS class, pero el texto fuente es lowercase)
    expect(container.textContent).toContain("Rey del día");
    const wrapper = container.querySelector("span[aria-label]");
    expect(wrapper?.getAttribute("aria-label")).toBe("Rey del día");
  });

  it("loneWinner=true con variant='compact' usa aria-label especial", () => {
    const { container } = render(<DayWinnerBadge variant="compact" loneWinner />);
    const span = container.querySelector("span");
    expect(span?.getAttribute("aria-label")).toBe("Rey del día (único jugador)");
    expect(span?.getAttribute("title")).toBe("Rey del día (único jugador)");
  });

  it("loneWinner=true con variant='full' muestra el texto especial visible", () => {
    const { container } = render(<DayWinnerBadge variant="full" loneWinner />);
    expect(container.textContent).toContain("Rey del día (único jugador)");
    const wrapper = container.querySelector("span[aria-label]");
    expect(wrapper?.getAttribute("aria-label")).toBe("Rey del día (único jugador)");
  });
});
