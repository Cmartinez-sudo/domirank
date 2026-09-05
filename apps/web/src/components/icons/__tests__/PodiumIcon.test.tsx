/**
 * Tests for PodiumIcon.
 * Run: pnpm vitest run src/components/icons/__tests__/PodiumIcon.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PodiumIcon } from "../PodiumIcon";

describe("PodiumIcon", () => {
  it("renders an SVG with aria-hidden", () => {
    const { container } = render(<PodiumIcon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies the size prop to width and height", () => {
    const { container } = render(<PodiumIcon size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it("applies the className prop", () => {
    const { container } = render(<PodiumIcon className="text-primary" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("text-primary")).toBe(true);
  });

  it("has correct viewBox and stroke attributes", () => {
    const { container } = render(<PodiumIcon />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("fill")).toBe("none");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("stroke-width")).toBe("1.8");
  });

  it("matches snapshot", () => {
    const { container } = render(<PodiumIcon />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
