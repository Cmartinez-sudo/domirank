import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { VoidMatchButton } from "./VoidMatchButton";

export const dynamic = "force-dynamic";

export default async function MatchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  let currentUserId: string | null = null;
  try { const u = await requireUser(); currentUserId = u.id; } catch {}

  const { data: match } = await supabase
    .from("match_feed")
    .select("*")
    .eq("id", id)
    .single();

  if (!match) return notFound();

  const teams = new Map<number, any[]>();
  for (const p of (match.players ?? []) as any[]) {
    if (!p?.user_id) continue;
    if (!teams.has(p.team)) teams.set(p.team, []);
    teams.get(p.team)!.push(p);
  }
  const teamList = Array.from(teams.entries()).sort(([a], [b]) => a - b);

  const isVoided   = match.status === "voided";
  const isCreator  = currentUserId && match.created_by === currentUserId;
  const canVoid    = isCreator && match.status === "completed";

  return (
    <div className="space-y-6">
      {isVoided && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm font-medium">
          <span>⚠</span>
          <span>Esta partida fue anulada. Los ratings han sido revertidos.</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-text-mute text-sm">
            {match.format === "singles" ? "Singles" : "Parejas"} · a {match.target_points} pts ·{" "}
            {new Date(match.created_at).toLocaleString("es")}
          </div>
          <h1 className="text-3xl font-bold mt-1">Partida</h1>
        </div>
        {canVoid && <VoidMatchButton matchId={id} />}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {teamList.map(([teamNo, players]) => {
          const score = players[0]?.score ?? 0;
          const won = players[0]?.rank === 1;
          return (
            <div key={teamNo} className={`card ${won ? "border-primary/50" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Equipo {teamNo}</h2>
                {won && <span className="badge bg-primary/15 text-primary">Ganador</span>}
              </div>
              <div className="text-4xl font-mono font-bold mb-4">{score}</div>
              <ul className="space-y-3">
                {players.map((p) => {
                  const delta = Number(p.mu_after) - Number(p.mu_before);
                  return (
                    <li key={p.user_id} className="flex items-center justify-between text-sm">
                      <Link href={`/profile/${p.username}`} className="hover:text-primary">
                        {p.display_name || p.username}
                      </Link>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-text-mute">{Number(p.mu_before).toFixed(2)}</span>
                        <span className="text-text-mute">→</span>
                        <span>{Number(p.mu_after).toFixed(2)}</span>
                        <span className={delta >= 0 ? "text-primary" : "text-danger"}>
                          ({delta >= 0 ? "+" : ""}{delta.toFixed(2)})
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
