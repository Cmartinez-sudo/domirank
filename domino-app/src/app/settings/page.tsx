import { requireUser, getCurrentProfile } from "@/lib/auth";
import { getUserPreferences } from "@/lib/user-preferences-actions";
import { SettingsForm } from "./SettingsForm";
import { SecondaryPageShell } from "@/components/SecondaryPageShell";
import { BACK_FALLBACKS } from "@/lib/back-fallbacks";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const profile: any = await getCurrentProfile();
  const initialPrefs = await getUserPreferences().catch(() => null);
  return (
    <SecondaryPageShell title="Ajustes" fallbackPath="/dashboard">
      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <SettingsForm
          email={user.email ?? ""}
          profile={{
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            country: profile.country,
            default_modality: profile.default_modality ?? "ven",
            email_notifications: profile.email_notifications ?? true,
          }}
          initialPreferences={initialPrefs}
        />
      </div>
    </SecondaryPageShell>
  );
}
