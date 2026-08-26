// Consent handling for optional analytics (PostHog). Persisted in localStorage.
//
// Strictly-necessary cookies (Supabase Auth session) are always allowed and do
// NOT depend on this flag — see /privacy for the breakdown.

export const CONSENT_STORAGE_KEY = "domirank.cookie-consent.v1";

export type ConsentValue = "accepted" | "rejected" | null;

/**
 * Read the persisted consent decision. Returns null if the user hasn't decided.
 * SSR-safe.
 */
export function getConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw === "accepted" || raw === "rejected") return raw;
    return null;
  } catch {
    return null;
  }
}

export function setConsent(value: "accepted" | "rejected"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent("domirank:consent-changed", { detail: value }));
  } catch {
    // localStorage may be blocked; consent effectively defaults to rejected.
  }
}

export function hasAcceptedAnalytics(): boolean {
  return getConsent() === "accepted";
}
