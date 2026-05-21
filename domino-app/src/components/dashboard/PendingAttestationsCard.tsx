import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type PendingMatch = {
  id: string;
  format: string;
  target_points: number;
  modality: string | null;
  finalized_at: string;
  players: Array<{
    user_id: string;
    username: string;
    display_name: string | null;
    team: number;
    score: number;
    rank: number | null;
  }>;
};

/**
 * Widget de dashboard: lista partidas pendientes de tu firma.
 * Server component — se renderiza solo si el viewer tiene ≥1 pendientes.
 * Defensivo: si CUALQUIER query falla, devuelve null silenciosamente.
 */
export async function PendingAttestationsCard({ userId }: { userId: string }) {
  let toShow: PendingMatch[] = [];

  try {
    const supabase = await supabaseServer();

    const { data: rows, error: rowsErr } = await supabase
      .from("match_feed")
      .select("*")
      .eq("status", "pending_attestation")
      .order("created_at", { ascending: false })
      .limit(20);
    if (rowsErr) {
      console.error("[PendingAttestationsCard] match_feed failed:", rowsErr.message);
      return null;
    }

    const pending: PendingMatch[] = ((rows ?? []) as any[])
      .filter((m) => Array.isArray(m?.players) && m.players.some((p: any) => p?.user_id === userId));

    if (pending.length === 0) return null;

    const matchIds = pending.map((m) => m.id);
    const { data: myAttestations, error: attErr } = await supabase
      .from("match_attestations")
      .select("match_id")
      .eq("user_id", userId)
      .in("match_id", matchIds);
    if (attErr) {
      console.error("[PendingAttestationsCard] attestations failed:", attErr.message);
      return null;
    }
    const signed = new Set((myAttestations ?? []).map((a) => a.match_id));
    toShow = pending.filter((m) => !signed.has(m.id));
  } catch (e) {
    console.error("[PendingAttestationsCard] unexpected error:", e);
    return null;
  }

  if (toShow.length === 0) return null;

  return (
    <section
      className="card"
      style={{
        background: "linear-gradient(135deg, rgba(250,204,21,.06), rgba(250,204,21,.02))",
        borderColor: "rgba(250,204,21,.25)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-yellow-400">🟡</span>
          Pendientes de tu firma ({toShow.length})
        </h2>
      </div>
      <ul className="space-y-2">
        {toShow.slice(0, 3).map((m) => {
          const teams = new Map<number, typeof m.players>();
          for (const p of m.players) {
            if (!teams.has(p.team)) teams.set(p.team, []);
            teams.get(p.team)!.push(p);
          }
          const teamA = teams.get(1) ?? [];
          const teamB = teams.get(2) ?? [];
          const scoreA = teamA[0]?.score ?? 0;
          const scoreB = teamB[0]?.score ?? 0;
          const namesA = teamA.map((p) => (p.display_name || p.username).split(" ")[0]).join(" & ");
          const namesB = teamB.map((p) => (p.display_name || p.username).split(" ")[0]).join(" & ");

          return (
            <li key={m.id}>
              <Link
                href={`/matches/${m.id}`}
                className="flex items-center justify-between gap-3 p-3 bg-surface-2 rounded-xl hover:bg-surface-3 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-mute">
                    {m.modality ?? "—"} · {new Date(m.finalized_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
                  </div>
                  <div className="text-sm font-medium truncate mt-0.5">
                    {namesA} <span className="font-mono">{scoreA}</span>
                    <span className="text-text-mute"> — </span>
                    <span className="font-mono">{scoreB}</span> {namesB}
                  </div>
                </div>
                <span className="text-primary text-sm font-semibold shrink-0">Firmar →</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {toShow.length > 3 && (
        <p className="text-text-mute text-xs mt-3">
          Y {toShow.length - 3} más. Confirma cada una desde su detalle.
        </p>
      )}
    </section>
  );
}
