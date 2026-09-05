"use client";

import { useEffect, useState } from "react";

export type MotionPreference = "user" | "reduced" | "always";
const STORAGE_KEY = "domirank-motion";
const EVENT = "domirank:motion-change";

function readInitial(): MotionPreference {
  if (typeof window === "undefined") return "user";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "reduced" || stored === "always" ? stored : "user";
}

/**
 * User-facing override for `prefers-reduced-motion`. Values:
 * - "user"    → honor OS setting (default; matches MotionConfig default)
 * - "reduced" → force reduced motion regardless of OS
 * - "always"  → force full motion regardless of OS
 *
 * State is shared across all subscribers via a window event, so the toggle
 * in Settings and the MotionGate at the root stay in sync without a global
 * store.
 */
export function useMotionPreference(): [MotionPreference, (next: MotionPreference) => void] {
  const [pref, setPref] = useState<MotionPreference>("user");

  useEffect(() => {
    setPref(readInitial());
    const onChange = (e: Event) => {
      const value = (e as CustomEvent<MotionPreference>).detail;
      setPref(value);
    };
    window.addEventListener(EVENT, onChange as EventListener);
    return () => window.removeEventListener(EVENT, onChange as EventListener);
  }, []);

  const update = (next: MotionPreference) => {
    if (typeof window === "undefined") return;
    if (next === "user") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent<MotionPreference>(EVENT, { detail: next }));
  };

  return [pref, update];
}
