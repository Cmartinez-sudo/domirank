'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

/**
 * Discreet theme toggle overlay for the public display.
 *
 * Rendered as a fixed sun/moon button anchored to the bottom-right of
 * the viewport. `right-6` (24px) matches the header's `px-6` padding
 * so this button lines up on the same visual x-axis as the
 * FullscreenToggle in the top header cluster — one at the top, this
 * one at the bottom, both flush to the right edge.
 *
 * We render neutral markup until mounted so SSR/hydration don't diverge
 * (`resolvedTheme` is client-only in next-themes).
 */
export function DisplayThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLight = mounted && resolvedTheme === 'light';
  const next = isLight ? 'dark' : 'light';
  const label = isLight ? 'Activar tema oscuro' : 'Activar tema claro';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
      className="fixed bottom-4 right-6 z-50 inline-flex h-8 w-8 items-center justify-center rounded-full bg-bg/70 text-text-mute opacity-40 ring-1 ring-inset ring-border backdrop-blur transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <span aria-hidden="true" className="inline-flex">
        {isLight ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
