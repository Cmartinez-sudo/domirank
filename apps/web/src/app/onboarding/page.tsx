import { requireUser, getCurrentProfile } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";
import { OnboardingFormV2 } from "./OnboardingFormV2";

export const dynamic = "force-dynamic";

// Sprint 1b: feature flag para rollback rápido durante rollout.
// Default true; setear NEXT_PUBLIC_ONBOARDING_V2=false para revertir al V1.
const USE_V2 = process.env.NEXT_PUBLIC_ONBOARDING_V2 !== "false";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireUser();
  const profile: any = await getCurrentProfile();
  const params = await searchParams;
  const isMigration = params.mode === "migration";

  if (!USE_V2) {
    return (
      <div className="max-w-xl mx-auto">
        <OnboardingForm
          initialCountry={profile?.country ?? null}
          initialModality={profile?.default_modality ?? null}
        />
      </div>
    );
  }

  // Sprint 1b: cargar progreso incremental (Regla 8).
  const supabase = await supabaseServer();
  const { data: progress } = await supabase
    .from("onboarding_progress")
    .select("answers, current_step")
    .eq("user_id", profile.id)
    .maybeSingle();

  const rawAnswers = (progress?.answers as Record<string, number | string | boolean> | undefined) ?? {};
  const rawStep = (progress?.current_step as string | null | undefined) ?? null;

  // Normalizar rawStep "skill.qN" → "skill" (el sub-step lo maneja el componente).
  const initialStep = rawStep?.startsWith("skill") ? "skill" : rawStep;

  const displayName =
    profile?.display_name ??
    profile?.full_name ??
    profile?.username ??
    "jugador";

  const needsDob = profile?.date_of_birth == null;

  return (
    <div className="max-w-xl mx-auto">
      <OnboardingFormV2
        displayName={displayName}
        initialCountry={profile?.country ?? null}
        initialModality={profile?.default_modality ?? null}
        initialDob={profile?.date_of_birth ?? null}
        initialAvatarUrl={profile?.avatar_url ?? null}
        needsDob={needsDob}
        initialAnswers={rawAnswers}
        initialStep={
          isMigration
            ? "profile"
            : initialStep === "welcome" ||
              initialStep === "profile" ||
              initialStep === "skill" ||
              initialStep === "avatar" ||
              initialStep === "howitworks" ||
              initialStep === "celebration"
            ? initialStep
            : null
        }
        arrivedViaReferral={!!profile?.referred_by}
        mode={isMigration ? "migration" : "signup"}
      />
    </div>
  );
}
