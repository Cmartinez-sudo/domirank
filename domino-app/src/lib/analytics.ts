import posthog from "posthog-js";

export type EventName =
  | "user_signed_up"
  | "user_completed_onboarding"
  | "match_created"
  | "match_finalized"
  | "match_attested"
  | "friend_request_sent"
  | "tournament_created"
  | "club_joined"
  | "modality_preference_set"
  | "modality_override_used"
  | "modality_step_skipped";
// ampliar según taxonomía documentada en docs/ANALYTICS_EVENTS.md

export type EventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

class Analytics {
  private initialized = false;

  init(): void {
    if (typeof window === "undefined" || this.initialized) return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (process.env.NODE_ENV !== "production") return; // skip en dev/test

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      person_profiles: "identified_only",
      capture_pageview: true,
      autocapture: true,
      session_recording: {
        maskAllInputs: true,
      },
    });
    this.initialized = true;
  }

  identify(userId: string, properties?: EventProperties): void {
    if (!this.initialized) return;
    posthog.identify(userId, properties);
  }

  track(event: EventName, properties?: EventProperties): void {
    if (!this.initialized) return;
    posthog.capture(event, properties);
  }

  reset(): void {
    if (!this.initialized) return;
    posthog.reset();
  }
}

export const analytics = new Analytics();
