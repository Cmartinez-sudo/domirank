"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLORS = {
  dark: "#0a1020",
  light: "#f8fafc",
} as const;

/**
 * Keeps the browser/PWA status-bar tint in sync with the active theme.
 * Without this, iOS PWAs render the notch area with the static viewport
 * theme-color regardless of what the user picked in-app.
 */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const color = THEME_COLORS[resolvedTheme === "light" ? "light" : "dark"];
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", color);
    } else {
      const created = document.createElement("meta");
      created.name = "theme-color";
      created.content = color;
      document.head.appendChild(created);
    }
  }, [resolvedTheme]);

  return null;
}
