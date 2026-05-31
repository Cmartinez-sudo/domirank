/**
 * Component tests for WizardStepLayout.
 * Run: pnpm vitest run src/components/__tests__/WizardStepLayout.test.tsx
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { WizardStepLayout } from "../wizard/WizardStepLayout";

// Mock next/navigation for StepHeader
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

/**
 * Creates a ResizeObserver mock that fires immediately with the given
 * contentHeight when `observe()` is called.
 */
function makeResizeObserver(contentHeight: number) {
  return class MockResizeObserver {
    private callback: ResizeCallback;

    constructor(cb: ResizeCallback) {
      this.callback = cb;
    }

    observe(target: Element) {
      // Fire synchronously so the state update happens before the snapshot
      act(() => {
        this.callback([
          {
            contentRect: { height: contentHeight } as DOMRectReadOnly,
            target,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          },
        ]);
      });
    }

    disconnect() {}
    unobserve() {}
  };
}

beforeEach(() => {
  // window.innerHeight defaults to 768 in jsdom
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: 768,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const BASE_ACTION = { label: "Continuar" };

describe("WizardStepLayout — content size detection", () => {
  it("snapshot: small mode (contentHeight = 200, ≤ 50% viewport)", () => {
    vi.stubGlobal("ResizeObserver", makeResizeObserver(200));
    const { container } = render(
      <WizardStepLayout currentStep={1} primaryAction={BASE_ACTION}>
        <p>Contenido pequeño</p>
      </WizardStepLayout>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("snapshot: medium mode (contentHeight = 500, ≤ 100% viewport - header/footer space)", () => {
    // 500 > 768*0.5=384, but 500 ≤ 768-120=648
    vi.stubGlobal("ResizeObserver", makeResizeObserver(500));
    const { container } = render(
      <WizardStepLayout currentStep={2} primaryAction={BASE_ACTION}>
        <p>Contenido mediano</p>
      </WizardStepLayout>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("snapshot: large mode (contentHeight = 1200, overflow)", () => {
    // 1200 > 768-120=648
    vi.stubGlobal("ResizeObserver", makeResizeObserver(1200));
    const { container } = render(
      <WizardStepLayout currentStep={3} primaryAction={BASE_ACTION} forceSticky>
        <p>Contenido largo</p>
      </WizardStepLayout>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe("WizardStepLayout — primary action states", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", makeResizeObserver(200));
  });

  it("shows spinner and label 'Procesando…' when pending=true", () => {
    const { getByText } = render(
      <WizardStepLayout
        currentStep={1}
        primaryAction={{ ...BASE_ACTION, pending: true }}
      >
        <p>Contenido</p>
      </WizardStepLayout>,
    );
    expect(getByText("Procesando…")).toBeDefined();
  });

  it("sets aria-busy=true on button when pending=true", () => {
    const { container } = render(
      <WizardStepLayout
        currentStep={1}
        primaryAction={{ ...BASE_ACTION, pending: true }}
      >
        <p>Contenido</p>
      </WizardStepLayout>,
    );
    const btn = container.querySelector("footer button");
    expect(btn?.getAttribute("aria-busy")).toBe("true");
  });

  it("button is disabled when disabled=true", () => {
    const { container } = render(
      <WizardStepLayout
        currentStep={1}
        primaryAction={{ ...BASE_ACTION, disabled: true }}
      >
        <p>Contenido</p>
      </WizardStepLayout>,
    );
    const btn = container.querySelector("footer button") as HTMLButtonElement;
    expect(btn?.disabled).toBe(true);
  });

  it("renders hint text when provided", () => {
    const { getByText } = render(
      <WizardStepLayout
        currentStep={1}
        primaryAction={BASE_ACTION}
        hint="Este es un mensaje de ayuda"
      >
        <p>Contenido</p>
      </WizardStepLayout>,
    );
    expect(getByText("Este es un mensaje de ayuda")).toBeDefined();
  });
});

describe("WizardStepLayout — forceSticky", () => {
  it("uses large (sticky) mode regardless of contentHeight when forceSticky=true", () => {
    // Even with tiny contentHeight, forceSticky forces large mode
    vi.stubGlobal("ResizeObserver", makeResizeObserver(50));
    const { container } = render(
      <WizardStepLayout currentStep={3} primaryAction={BASE_ACTION} forceSticky>
        <p>Contenido</p>
      </WizardStepLayout>,
    );
    // Footer should have sticky classes
    const footer = container.querySelector("footer");
    expect(footer?.className).toContain("sticky");
  });
});
