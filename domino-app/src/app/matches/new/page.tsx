import { requireOnboardedUser, getCurrentProfile } from "@/lib/auth";
import { getUserPreferences } from "@/lib/user-preferences-actions";
import { NewMatchForm } from "./NewMatchForm";
import { TournamentFastPath } from "./TournamentFastPath";

export const dynamic = "force-dynamic";

export default async function NewMatchPage({
  searchParams,
}: {
  searchParams: Promise<{ tournament?: string; pairing?: string }>;
}) {
  await requireOnboardedUser();

  const params = await searchParams;
  const tournamentId = params.tournament ?? null;
  const pairingId = params.pairing ?? null;

  // ── Fast path: crear partida directamente desde el hero del torneo ──
  // Si el usuario llegó con ?tournament=X&pairing=Y, saltamos el wizard
  // y creamos la partida usando los datos del torneo.
  if (tournamentId && pairingId) {
    return (
      <TournamentFastPath
        tournamentId={tournamentId}
        pairingId={pairingId}
      />
    );
  }

  // ── Wizard normal ─────────────────────────────────────────
  const profile: any = await getCurrentProfile();

  // Fetch preferences server-side para evitar round-trip del cliente.
  // Si falla (ej: migración 0034 aún no aplicada), initialPreferences será
  // null y el hook cliente usará los defaults seguros.
  let initialPreferences = null;
  try {
    initialPreferences = await getUserPreferences();
  } catch (err) {
    console.warn("[NewMatchPage] No se pudieron cargar preferences:", err);
  }

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
        initialPreferences={initialPreferences}
      />
    </div>
  );
}
