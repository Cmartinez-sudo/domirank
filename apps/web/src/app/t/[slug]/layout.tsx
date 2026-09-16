import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  // Theme color is dynamic per theme — the root ThemeColorSync updates
  // the meta tag on light/dark switch, so we omit a static value here.
};

/**
 * The public display layout is intentionally bare — no AppShell, no
 * navigation, no PWA prompts. The page is meant to be projected on a TV
 * in fullscreen via the venue's browser, and any chrome would compete
 * with the tournament data for screen real estate.
 *
 * The `<html>` and `<body>` come from the root layout above us; AppShell
 * detects /t/* and renders only `{children}` (no sidebar, no bottom nav,
 * no max-width container). Colors come from the theme tokens (bg-bg /
 * text-text) so the display follows the user's light/dark preference.
 */
export default function PublicDisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-bg text-text">
      {children}
    </div>
  );
}
