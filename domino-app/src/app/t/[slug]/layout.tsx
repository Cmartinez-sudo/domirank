import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * The public display layout is intentionally bare — no AppShell, no
 * navigation, no PWA prompts. The page is meant to be projected on a TV
 * in fullscreen via the venue's browser, and any chrome would compete
 * with the tournament data for screen real estate.
 *
 * The `<html>` and `<body>` come from the root layout above us; we
 * just wrap children in a black-background container.
 */
export default function PublicDisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {children}
    </div>
  );
}
