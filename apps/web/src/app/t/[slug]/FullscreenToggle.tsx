'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Fullscreen toggle for the public TV display.
 *
 * Uses the native Fullscreen API. Browsers require a user gesture to
 * enter fullscreen (security), so this can never be triggered on page
 * load — the operator taps once and the venue TV enters kiosk mode.
 * Pressing ESC (or the same button again) exits.
 *
 * Kept as a sibling to `DisplayThemeToggle` so both live in the header
 * top-right cluster with matching styling.
 */
export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // Feature detect once. Some in-app browsers (older Safari on iOS)
    // don't expose requestFullscreen — hide the button rather than
    // show one that does nothing.
    if (typeof document === 'undefined') return;
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const canEnter = !!(el.requestFullscreen || el.webkitRequestFullscreen);
    setSupported(canEnter);

    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
      if (req) void req.call(el).catch(() => {});
    }
  }, []);

  if (!supported) return null;

  const label = isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggle}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-mute opacity-40 ring-1 ring-inset ring-border transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <span aria-hidden="true" className="inline-flex">
        {isFullscreen ? <ExitIcon /> : <EnterIcon />}
      </span>
    </button>
  );
}

function EnterIcon() {
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
      <path d="M4 9V5a1 1 0 0 1 1-1h4" />
      <path d="M20 9V5a1 1 0 0 0-1-1h-4" />
      <path d="M4 15v4a1 1 0 0 0 1 1h4" />
      <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    </svg>
  );
}

function ExitIcon() {
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
      <path d="M9 4H5a1 1 0 0 0-1 1v4" />
      <path d="M15 4h4a1 1 0 0 1 1 1v4" />
      <path d="M9 20H5a1 1 0 0 1-1-1v-4" />
      <path d="M15 20h4a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}
