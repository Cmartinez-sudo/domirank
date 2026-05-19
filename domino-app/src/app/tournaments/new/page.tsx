import { requireOnboardedUser, getCurrentProfile } from "@/lib/auth";
import { NewTournamentForm } from "./NewTournamentForm";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  await requireOnboardedUser();
  const profile: any = await getCurrentProfile();
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Nueva polla</h1>
      <p className="text-text-dim">Sistema de rotación: cada partida se eligen 4 jugadores, se sortean parejas y se juega.</p>
      <NewTournamentForm
        currentUser={{
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          country: profile.country,
        }}
        defaultModality={profile?.default_modality ?? "dom"}
      />
    </div>
  );
}
