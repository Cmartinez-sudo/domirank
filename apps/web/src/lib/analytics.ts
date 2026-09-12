import posthog from "posthog-js";
import { hasAcceptedAnalytics } from "./consent";

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
  | "modality_step_skipped"
  // Sprint 1a — Referral + Group join link + Notif referrer
  | "referral_signup_completed"
  | "group_join_code_generated"
  | "group_join_code_redeemed"
  | "group_join_link_copied"
  | "group_join_link_shared"
  | "referrer_notified"
  | "matches_preload_used"
  // Sprint 1b — Onboarding v2 + P1 + first_valuable_action
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "onboarding_step_completed"
  | "onboarding_step_skipped"
  | "onboarding_skipped_global"
  | "onboarding_completed"
  | "onboarding_abandoned"
  | "p1_screen_viewed"
  | "p1_cta_tapped"
  | "p1_dismissed"
  | "first_invite_sent"
  | "first_valuable_action"
  | "match_attested_first_time"
  // Sprint 1c — Settings + Coach marks + Legacy
  | "skill_recalibrated"
  | "dob_edited"
  | "hint_shown"
  | "hint_dismissed"
  | "legacy_reonboarding_banner_shown"
  | "legacy_reonboarding_started"
  | "legacy_reonboarding_completed";
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
    if (!hasAcceptedAnalytics()) return; // esperar consentimiento explícito

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
