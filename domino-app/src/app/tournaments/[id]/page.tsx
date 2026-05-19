import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { MODALIDADES, COUNTRIES } from "@/lib/modalidades";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TournamentDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();
  if (!tournament) return notFound();

  const { data: standings } = await supabase
    .from("tournament_standings")
    .select("*")
    .eq("tournament_id", id);

  const { data: matches } = await supabase
    .from("matches")
    .select("id, set_size, format, created_at, status, match_players(team, score, user_id, rank, profiles(username, display_name, avatar_url, country))")
    .eq("tournament_id", id)
    .order("created_at", { ascending: false })
    .limit(30);

  const sorted = (standings ?? []).slice().sort((a: any, b: any) => {
    if (b.points_for !== a.points_for) return b.points_for - a.points_for;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.points_for - b.points_against) - (a.points_for - a.points_against);
  });

  const m = MODALIDADES[tournament.modality as keyof typeof MODALIDADES] ?? MODALIDADES.custom;
  const visibility = tournament.visibility;
  const isOwner = user?.id === tournament.created_by;

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🍻</span>
            <div>
              <h1 className="text-2xl font-bold">{tournament.name}</h1>
              <div className="text-text-mute text-sm mt-0.5">
                {m.flag} {m.name} · {tournament.points_to_win} pts {tournament.continuous && "· ∞"} {tournament.rated ? " · rankeada" : " · casual"}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <VisibilityBadge v={visibility} />
            {tournament.status === "active" && isOwner && (
              <Link href={`/matches/new?tournament=${id}`} className="btn-primary text-sm">
                + Jugar partida
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="card p-0 overflow-hidden">
        <h2 className="px-4 py-3 border-b border-border font-semibold">Standings</h2>
        {sorted.length === 0 ? (
          <div className="p-6 text-center text-text-mute">Aún no se han jugado partidas en esta polla.</div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((s: any, i: number) => (
              <div key={s.user_id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-text-mute w-6 text-right text-sm">{i + 1}</span>
                <Avatar player={s as any} size={32} />
                <Link href={`/profile/${s.username}`} className="font-medium hover:text-primary flex-1 truncate">
                  {s.display_name || s.username}
                </Link>
                <div className="text-sm text-text-dim hidden sm:block w-24 text-right">
                  <span className="text-primary">{s.wins}G</span> · <span className="text-danger">{s.losses}P</span>
                </div>
                <div className="font-mono text-sm w-28 text-right">
                  {s.points_for}<span className="text-text-mute mx-1">·</span>{s.points_against}
                </div>
                <div className="font-mono text-sm font-semibold w-12 text-right">
                  {s.win_pct ? `${Number(s.win_pct).toFixed(0)}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-0 overflow-hidden">
        <h2 className="px-4 py-3 border-b border-border font-semibold">Partidas ({matches?.length ?? 0})</h2>
        {!matches || matches.length === 0 ? (
          <div className="p-6 text-center text-text-mute">Sin partidas.</div>
        ) : (
          matches.map((mm: any) => {
            const teams: Record<number, any[]> = {};
            for (const mp of mm.match_players ?? []) {
              (teams[mp.team] ??= []).push(mp);
            }
            const teamArr = Object.entries(teams).sort(([a],[b]) => +a - +b);
            const winner = mm.status === "completed" ? teamArr.find(([, ps]) => ps[0]?.rank === 1) : null;
            return (
              <Link
                key={mm.id}
                href={mm.status === "in_progress" ? `/matches/${mm.id}/live` : `/matches/${mm.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/30 hover:bg-surface-2/60 first:border-t-0"
              >
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {teamArr.map(([t, ps], i) => (
                    <span key={t} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-text-mute mx-1">vs</span>}
                      {ps.map((p: any) => (
                        <Avatar key={p.user_id} player={p.profiles} size={22} />
                      ))}
                      <span className={`font-mono font-semibold ${winner && winner[0] === t ? "text-primary" : ""}`}>{ps[0]?.score ?? 0}</span>
                    </span>
                  ))}
                </div>
                <div className="text-text-mute text-xs shrink-0">
                  {mm.status === "in_progress" && <span className="badge bg-warning/15 text-warning mr-2">en curso</span>}
                  {new Date(mm.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                </div>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}

function VisibilityBadge({ v }: { v: string }) {
  if (v === "public") return <span className="badge bg-info/15 text-info">🌍 Pública</span>;
  if (v === "friends") return <span className="badge bg-warning/15 text-warning">👥 Amigos</span>;
  return <span className="badge bg-surface-2 text-text-mute">🔒 Privada</span>;
}
