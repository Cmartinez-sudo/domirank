import { requireUser, getCurrentProfile } from "@/lib/auth";
import { COUNTRIES, MODALIDADES } from "@/lib/modalidades";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireUser();
  const profile: any = await getCurrentProfile();
  return (
    <div className="max-w-xl mx-auto">
      <OnboardingForm
        initialCountry={profile?.country ?? null}
        initialModality={profile?.default_modality ?? null}
      />
    </div>
  );
}
