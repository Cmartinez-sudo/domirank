"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Root theme provider. Dark is the default and users opt into light via the
 * toggle in the drawer/settings. System preference is intentionally ignored
 * so DomiRank's identity stays consistent on first launch across devices.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      themes={["dark", "light"]}
      disableTransitionOnChange={false}
      storageKey="domirank-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
