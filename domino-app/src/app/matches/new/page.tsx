import { requireOnboardedUser, getCurrentProfile } from "@/lib/auth";
import { NewMatchForm } from "./NewMatchForm";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  await requireOnboardedUser();
  const profile: any = await getCurrentProfile();

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Nueva partida</h1>
      <p className="text-text-dim">
        Elige modalidad y oponentes. Al cerrar la partida, los 4 jugadores
        firman el resultado — el rating aplica solo con consenso.
      </p>
      <NewMatchForm
        currentUser={{
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          country: profile.country,
        }}
        defaultModality={profile?.default_modality ?? "ven"}
      />
    </div>
  );
}
