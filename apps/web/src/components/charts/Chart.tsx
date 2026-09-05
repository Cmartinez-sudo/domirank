"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { EChartsOption, ECharts } from "echarts";

/**
 * Base ECharts wrapper. Vanilla modular import — only the pieces the wrappers
 * on top of us need get shipped. All specific charts (line, heatmap, gauge,
 * bar) live in sibling files and construct their `option` in terms of ECharts
 * config, then hand it here.
 *
 * SSR-safe: the ECharts modules are `await import()`ed inside `useEffect`,
 * so nothing lands in the server bundle. During SSR and first paint, callers
 * see the `<Skeleton/>` placeholder — layout stays intact.
 *
 * Theme: registers `domirank-dark` and `domirank-light` on first mount by
 * reading the CSS vars from `document.documentElement`. Theme changes fully
 * re-init the chart (ECharts themes are frozen at init time).
 */
type Props = {
  option: EChartsOption;
  height: number | string;
  /** ARIA label describing the chart to screen readers. Required. */
  ariaLabel: string;
  className?: string;
  /**
   * If the caller needs to react to hover/click, pass a listener setup.
   * Called once with the instance after init; return a cleanup function.
   */
  onReady?: (instance: ECharts) => void | (() => void);
};

let themesRegistered = false;

function readVar(name: string): string {
  if (typeof window === "undefined") return "";
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function rgbVar(name: string, alpha = 1): string {
  const raw = readVar(name);
  if (!raw) return "rgba(0,0,0,0)";
  return alpha === 1 ? `rgb(${raw})` : `rgba(${raw.replace(/\s+/g, ",")},${alpha})`;
}

function borderVar(name: string): string {
  const raw = readVar(name);
  return raw || "rgba(0,0,0,0.1)";
}

/**
 * Builds a theme object from the current CSS vars. Called for both `dark`
 * and `light` by temporarily toggling the class on <html> — necessary
 * because CSS vars only expose their resolved value for the current mode.
 */
function buildThemeSpec() {
  return {
    color: [
      rgbVar("--color-primary"),
      rgbVar("--color-info"),
      rgbVar("--color-warning"),
      rgbVar("--color-danger"),
      rgbVar("--color-team-a"),
      rgbVar("--color-team-b"),
    ],
    backgroundColor: "transparent",
    textStyle: {
      fontFamily:
        "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
      color: rgbVar("--color-text"),
    },
    title: { textStyle: { color: rgbVar("--color-text") } },
    line: { smooth: true, symbol: "circle", symbolSize: 6, lineStyle: { width: 2 } },
    categoryAxis: {
      axisLine: { lineStyle: { color: borderVar("--color-border") } },
      axisTick: { lineStyle: { color: borderVar("--color-border") } },
      axisLabel: { color: rgbVar("--color-text-mute") },
      splitLine: { lineStyle: { color: borderVar("--color-border") } },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: rgbVar("--color-text-mute") },
      splitLine: { lineStyle: { color: borderVar("--color-border") } },
    },
    tooltip: {
      backgroundColor: rgbVar("--color-surface"),
      borderColor: borderVar("--color-border-strong"),
      borderWidth: 1,
      textStyle: { color: rgbVar("--color-text"), fontSize: 12 },
      extraCssText: "box-shadow: var(--shadow-pop); border-radius: 12px;",
    },
    legend: { textStyle: { color: rgbVar("--color-text-dim") } },
  };
}

async function ensureThemesRegistered(echarts: typeof import("echarts")) {
  if (themesRegistered) return;
  // The user's active class stays applied afterwards.
  const html = document.documentElement;
  const wasLight = html.classList.contains("light");
  // Register dark first
  html.classList.remove("light");
  html.classList.add("dark");
  echarts.registerTheme("domirank-dark", buildThemeSpec());
  // Then light
  html.classList.remove("dark");
  html.classList.add("light");
  echarts.registerTheme("domirank-light", buildThemeSpec());
  // Restore original state
  html.classList.remove("dark");
  html.classList.remove("light");
  if (wasLight) html.classList.add("light");
  else html.classList.add("dark");
  themesRegistered = true;
}

export function Chart({ option, height, ariaLabel, className, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ECharts | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Init + theme reactivity. Theme change → full dispose + re-init because
  // ECharts themes cannot be swapped after init.
  useEffect(() => {
    if (!mounted) return;
    if (!containerRef.current) return;
    let cleanupOnReady: void | (() => void);
    let cancelled = false;

    (async () => {
      const echarts = await import("echarts/core");
      const { LineChart, BarChart, HeatmapChart, GaugeChart, EffectScatterChart } = await import("echarts/charts");
      const {
        GridComponent,
        TooltipComponent,
        VisualMapComponent,
        MarkLineComponent,
        MarkPointComponent,
      } = await import("echarts/components");
      const { CanvasRenderer } = await import("echarts/renderers");

      echarts.use([
        LineChart,
        BarChart,
        HeatmapChart,
        GaugeChart,
        EffectScatterChart,
        GridComponent,
        TooltipComponent,
        VisualMapComponent,
        MarkLineComponent,
        MarkPointComponent,
        CanvasRenderer,
      ]);

      await ensureThemesRegistered(echarts as unknown as typeof import("echarts"));

      if (cancelled || !containerRef.current) return;

      const themeName = resolvedTheme === "light" ? "domirank-light" : "domirank-dark";
      const instance = echarts.init(containerRef.current, themeName, {
        renderer: "canvas",
      });
      instance.setOption(option);
      instanceRef.current = instance;
      if (onReady) cleanupOnReady = onReady(instance);
    })();

    return () => {
      cancelled = true;
      if (typeof cleanupOnReady === "function") cleanupOnReady();
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
    // Re-init on theme swap. `option` changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, resolvedTheme]);

  // Option updates without full re-init.
  useEffect(() => {
    if (!instanceRef.current) return;
    instanceRef.current.setOption(option, { notMerge: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option]);

  // Auto-resize on container size changes.
  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => instanceRef.current?.resize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={
        (mounted ? "" : "animate-pulse bg-surface-2 rounded-lg ") + (className ?? "")
      }
      style={{ width: "100%", height, minHeight: typeof height === "number" ? height : undefined }}
    />
  );
}
