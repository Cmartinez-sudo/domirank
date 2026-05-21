import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { AdminResolveButtons } from "./AdminResolveButtons";

export const dynamic = "force-dynamic";

export const metadata = { title: "Disputes · Admin · DomiRank" };

export default async function AdminDisputesPage() {
  const user = await requireUser();
  const supabase = await supabaseServer();

  // Gating por rol
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") return notFound();

  // Cargar matches en disputa
  const { data: disputed } = await supabase
    .from("match_feed")
    .select("*")
    .eq("status", "disputed")
    .order("created_at", { ascending: false });

  const rows = (disputed ?? []) as any[];

  // Por cada match, cargar attestations
  const matchIds = rows.map((m) => m.id);
  let attestationsByMatch = new Map<string, any[]>();
  if (matchIds.length > 0) {
    const { data: atts } = await supabase
      .from("match_attestations")
      .select("match_id, user_id, action, comment, created_at")
      .in("match_id", matchIds);
    for (const a of (atts ?? []) as any[]) {
      if (!attestationsByMatch.has(a.match_id)) attestationsByMatch.set(a.match_id, []);
      attestationsByMatch.get(a.match_id)!.push(a);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Disputes</h1>
        <p className="text-text-dim text-sm mt-1">
          {rows.length === 0 ? "No hay partidas en disputa." : `${rows.length} partida${rows.length === 1 ? "" : "s"} requiere${rows.length === 1 ? "" : "n"} resolución.`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-5xl mb-3 opacity-40">✓</div>
          <p className="text-text-mute">Todo limpio.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((m) => {
            const players = (m.players ?? []) as any[];
            const teams = new Map<number, any[]>();
            for (const p of players) {
              if (!p?.user_id) continue;
              if (!teams.has(p.team)) teams.set(p.team, []);
              teams.get(p.team)!.push(p);
            }
            const teamList = Array.from(teams.entries()).sort(([a],[b]) => a - b);
            const atts = attestationsByMatch.get(m.id) ?? [];
            const confirms = atts.filter((a) => a.action === "confirm");
            const disputes = atts.filter((a) => a.action === "dispute");

            return (
              <div key={m.id} className="card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <Link href={`/matches/${m.id}`} className="font-semibold hover:text-primary">
                      Match · {new Date(m.created_at).toLocaleString("es")}
                    </Link>
                    <div className="text-text-mute text-xs mt-1">
                      {m.format === "singles" ? "Singles" : "Parejas"} · a {m.target_points} pts
                    </div>
                  </div>
                  <AdminResolveButtons matchId={m.id} />
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mt-4">
                  {teamList.map(([teamNo, ps]) => (
                    <div key={teamNo} className="bg-surface-2 rounded-xl p-3">
                      <div className="text-text-mute text-xs uppercase font-semibold">Equipo {teamNo}</div>
                      <div className="text-2xl font-mono font-bold">{ps[0]?.score ?? 0}</div>
                      <div className="text-sm mt-1">
                        {ps.map((p: any) => p.display_name || p.username).join(" & ")}
                      </div>
                    </div>
                  ))}
                </div>

                {confirms.length > 0 && (
                  <div className="mt-4">
                    <div className="text-text-mute text-xs uppercase font-semibold mb-1">
                      Confirmaciones ({confirms.length})
                    </div>
                    <ul className="text-sm space-y-1">
                      {confirms.map((c) => {
                        const p = players.find((pp: any) => pp.user_id === c.user_id);
                        return (
                          <li key={c.user_id} className="flex items-center gap-2 text-text-dim">
                            <Avatar player={p as any} size={20} />
                            <span>{p?.display_name || p?.username}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {disputes.length > 0 && (
                  <div className="mt-4">
                    <div className="text-danger text-xs uppercase font-semibold mb-1">
                      Reportes ({disputes.length})
                    </div>
                    <ul className="space-y-2">
                      {disputes.map((d) => {
                        const p = players.find((pp: any) => pp.user_id === d.user_id);
                        return (
                          <li key={d.user_id} className="flex items-start gap-2 p-2 bg-danger/5 border border-danger/20 rounded-lg">
                            <Avatar player={p as any} size={24} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{p?.display_name || p?.username}</div>
                              <div className="text-text-dim text-sm">
                                {d.comment || <span className="italic text-text-mute">Sin comentario</span>}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
