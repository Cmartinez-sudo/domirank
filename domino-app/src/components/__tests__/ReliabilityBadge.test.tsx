/**
 * Component tests for ReliabilityBadge (sprint Reliability NR R3.4).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(cleanup);
import { ReliabilityBadge } from "@/components/reliability/ReliabilityBadge";

describe("ReliabilityBadge — bucket rendering", () => {
  it.each([
    [0,   "Calibrando"],
    [29,  "Calibrando"],
    [30,  "En desarrollo"],
    [59,  "En desarrollo"],
    [60,  "Confiable"],
    [89,  "Confiable"],
    [90,  "Muy confiable"],
    [100, "Muy confiable"],
  ])("score=%i renders bucket label '%s'", (score, label) => {
    render(<ReliabilityBadge score={score} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("plain pill (no factors) is non-interactive <span>", () => {
    const { container } = render(<ReliabilityBadge score={70} />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.tagName).toBe("SPAN");
    // No focusable button inside
    expect(container.querySelector("button")).toBeNull();
  });

  it("showScore prefixes the percentage", () => {
    render(<ReliabilityBadge score={70} showScore />);
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.getByText("Confiable")).toBeTruthy();
  });
});

describe("ReliabilityBadge — tooltip variant", () => {
  const factors = { volume: 0.5, recency: 0.8, attestation: 0.9, diversity: 0.3 };

  it("with factors renders an interactive button", () => {
    const { container } = render(<ReliabilityBadge score={70} factors={factors} />);
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking the button opens tooltip with 4 factor rows", () => {
    render(<ReliabilityBadge score={70} factors={factors} />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Volumen")).toBeTruthy();
    expect(screen.getByText("Recencia")).toBeTruthy();
    expect(screen.getByText("Atestiguado")).toBeTruthy();
    expect(screen.getByText("Diversidad")).toBeTruthy();
  });

  it("factor percentages are rendered correctly", () => {
    render(<ReliabilityBadge score={70} factors={factors} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("50%")).toBeTruthy(); // volume
    expect(screen.getByText("80%")).toBeTruthy(); // recency
    expect(screen.getByText("90%")).toBeTruthy(); // attestation
    expect(screen.getByText("30%")).toBeTruthy(); // diversity
  });

  it("handles null factor values as 0%", () => {
    render(
      <ReliabilityBadge
        score={50}
        factors={{ volume: null, recency: null, attestation: null, diversity: null }}
      />
    );
    fireEvent.click(screen.getByRole("button"));
    // Four "0%" rows (one per factor) — score (50%) goes in header
    const zeros = screen.getAllByText("0%");
    expect(zeros.length).toBe(4);
  });
});
