import { requireUser, getCurrentProfile } from "@/lib/auth";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const profile: any = await getCurrentProfile();
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Ajustes</h1>
      <SettingsForm
        email={user.email ?? ""}
        profile={{
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          country: profile.country,
          default_modality: profile.default_modality ?? "ven",
        }}
      />
    </div>
  );
}
