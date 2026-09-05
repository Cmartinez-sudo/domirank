import { requireOnboardedUser, getCurrentProfile } from "@/lib/auth";
import { getUserPreferences } from "@/lib/user-preferences-actions";
import { supabaseServer } from "@/lib/supabase/server";
import { COUNTRIES, type PresetId } from "@/lib/modalidades";
import { NewMatchForm } from "./NewMatchForm";
import { TournamentFastPath } from "./TournamentFastPath";

export const dynamic = "force-dynamic";

/**
 * Sprint 3: top jugadores frecuentes con los que el viewer ya jugó.
 * Nos evita re-buscar por nombre a los mismos amigos en cada partida.
 * Ventana: últimos 60 matches. Excluye al mismo user y limita a 6.
 */
async function getFrequentPlayers(userId: string) {
  const supabase = await supabaseServer();

  // 1) Últimos matches del user.
  const { data: myRows } = await supabase
    .from("match_players")
    .select("match_id, matches!inner(created_at, status)")
    .eq("user_id", userId)
    .order("created_at", { foreignTable: "matches", ascending: false })
    .limit(60);

  type MyRow = { match_id: string; matches: { created_at: string; status: string } };
  const rows = (myRows as unknown as MyRow[] | null) ?? [];
  const relevantIds = rows
    .filter((r) => r.matches?.status !== "cancelled" && r.matches?.status !== "void")
    .map((r) => r.match_id);
  if (relevantIds.length === 0) return [] as Array<{
    id: string; username: string; display_name: string | null;
    avatar_url: string | null; country: string | null;
  }>;

  // 2) Coplayers de esos matches (excluye al viewer).
  const { data: coRows } = await supabase
    .from("match_players")
    .select("user_id")
    .in("match_id", relevantIds)
    .neq("user_id", userId);

  const counts = new Map<string, number>();
  for (const row of (coRows as Array<{ user_id: string }> | null) ?? []) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  }
  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);
  if (topIds.length === 0) return [];

  // 3) Profiles del top.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, country")
    .in("id", topIds);

  type Prof = { id: string; username: string; display_name: string | null; avatar_url: string | null; country: string | null };
  const map = new Map<string, Prof>();
  for (const p of (profiles as Prof[] | null) ?? []) map.set(p.id, p);
  return topIds
    .map((id) => map.get(id))
    .filter((p): p is Prof => !!p);
}

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

  let frequentPlayers: Awaited<ReturnType<typeof getFrequentPlayers>> = [];
  try {
    frequentPlayers = await getFrequentPlayers(profile.id);
  } catch (err) {
    console.warn("[NewMatchPage] No se pudieron cargar jugadores frecuentes:", err);
  }

  // Derivar defaultPreset a partir del país del onboarding.
  // Fallback "rapido" para users sin país o país sin mapeo directo.
  const country = COUNTRIES.find((c) => c.code === profile?.country);
  const defaultPreset: PresetId = country?.suggestedPreset ?? "rapido";

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
        defaultPreset={defaultPreset}
        initialPreferences={initialPreferences}
        frequentPlayers={frequentPlayers}
      />
    </div>
  );
}
