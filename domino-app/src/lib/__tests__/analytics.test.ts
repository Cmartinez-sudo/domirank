/**
 * Unit tests for src/lib/analytics.ts
 * Run with: pnpm vitest run src/lib/__tests__/analytics.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock posthog-js before importing analytics
vi.mock("posthog-js", () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    capture: vi.fn(),
    reset: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}));

import posthog from "posthog-js";
import { analytics } from "../analytics";

describe("Analytics wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("init() is no-op when NODE_ENV !== production (posthog.init never called)", () => {
    // In vitest, NODE_ENV is 'test' — not 'production' — so init must be a no-op
    analytics.init();
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("track() is no-op when analytics is not initialized (posthog.capture never called)", () => {
    // analytics.init() never set initialized=true (NODE_ENV=test), so track is a no-op
    analytics.track("match_created", { format: "singles", modality: "ven", tournament_id: null });
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
