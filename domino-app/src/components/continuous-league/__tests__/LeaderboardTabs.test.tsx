/** @vitest-environment jsdom */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { LeaderboardTabs } from "../LeaderboardTabs";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    children, href, ...props
  }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

afterEach(() => cleanup());

const BASE_PROPS = {
  tournamentId: "t1",
  seasonParam:  null,
  todayCount:   3,
  allCount:     12,
  createdAt:    "2026-05-01T10:00:00Z",
  globalContent: <div data-testid="global-content">GLOBAL TABLE</div>,
  todayContent:  <div data-testid="today-content">DAILY TABLE</div>,
};

describe("LeaderboardTabs", () => {
  it("activeTab='all' muestra globalContent, NO todayContent ni DateSelector", () => {
    const { container, queryByTestId } = render(
      <LeaderboardTabs
        {...BASE_PROPS}
        activeTab="all"
        selectedDay="2026-05-30"
        todaySessionDay="2026-05-31"
        availableDays={["2026-05-30"]}
      />,
    );
    expect(queryByTestId("global-content")).not.toBeNull();
    expect(queryByTestId("today-content")).toBeNull();
    // DateSelector tiene un button con aria-haspopup="listbox"
    expect(container.querySelector('button[aria-haspopup="listbox"]')).toBeNull();
  });

  it("activeTab='today' muestra todayContent, NO globalContent", () => {
    const { queryByTestId } = render(
      <LeaderboardTabs
        {...BASE_PROPS}
        activeTab="today"
        selectedDay="2026-05-31"
        todaySessionDay="2026-05-31"
        availableDays={["2026-05-31"]}
      />,
    );
    expect(queryByTestId("today-content")).not.toBeNull();
    expect(queryByTestId("global-content")).toBeNull();
  });

  it("activeTab='today' + availableDays=[] → DateSelector NO se renderiza", () => {
    const { container } = render(
      <LeaderboardTabs
        {...BASE_PROPS}
        activeTab="today"
        selectedDay="2026-05-31"
        todaySessionDay="2026-05-31"
        availableDays={[]}
      />,
    );
    expect(container.querySelector('button[aria-haspopup="listbox"]')).toBeNull();
  });

  it("activeTab='today' + availableDays con datos → DateSelector se renderiza", () => {
    const { container } = render(
      <LeaderboardTabs
        {...BASE_PROPS}
        activeTab="today"
        selectedDay="2026-05-31"
        todaySessionDay="2026-05-31"
        availableDays={["2026-05-30"]}
      />,
    );
    expect(container.querySelector('button[aria-haspopup="listbox"]')).not.toBeNull();
  });

  it("hrefs de tabs son correctos sin seasonParam", () => {
    const { container } = render(
      <LeaderboardTabs
        {...BASE_PROPS}
        activeTab="all"
      />,
    );
    const tabs = container.querySelectorAll('a[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].getAttribute("href")).toBe("/tournaments/t1");
    expect(tabs[1].getAttribute("href")).toBe("/tournaments/t1?day=today");
  });

  it("hrefs de tabs preservan seasonParam cuando viene", () => {
    const { container } = render(
      <LeaderboardTabs
        {...BASE_PROPS}
        activeTab="today"
        seasonParam={2}
      />,
    );
    const tabs = container.querySelectorAll('a[role="tab"]');
    expect(tabs[0].getAttribute("href")).toBe("/tournaments/t1?season=2");
    expect(tabs[1].getAttribute("href")).toBe("/tournaments/t1?day=today&season=2");
  });

  it("count chips muestran allCount y todayCount", () => {
    const { container } = render(
      <LeaderboardTabs
        {...BASE_PROPS}
        activeTab="all"
        todayCount={5}
        allCount={42}
      />,
    );
    expect(container.textContent).toContain("42");
    expect(container.textContent).toContain("5");
  });

  it("aria-selected refleja activeTab actual", () => {
    const { container } = render(
      <LeaderboardTabs
        {...BASE_PROPS}
        activeTab="today"
      />,
    );
    const tabs = container.querySelectorAll('a[role="tab"]');
    expect(tabs[0].getAttribute("aria-selected")).toBe("false");
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });
});
