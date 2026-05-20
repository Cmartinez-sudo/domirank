import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { MODALIDADES, COUNTRIES } from "@/lib/modalidades";
import { getCurrentUser } from "@/lib/auth";
import { formatInfo } from "@/lib/tournament-formats";
import { Bracket } from "@/components/Bracket";
import { GenerateNextRoundButton, GeneratePairingsButton } from "./TournamentActions";
import { PageTransition } from "@/components/Motion";

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

  const { data: pairings } = await supabase
    .from("tournament_pairings")
    .select("*")
    .eq("tournament_id", id)
    .order("round", { ascending: true })
    .order("board", { ascending: true });

  // Get profiles for bracket display
  const { data: tPlayers } = await supabase
    .from("tournament_players")
    .select("user_id, profiles(id, username, display_name, avatar_url)")
    .eq("tournament_id", id);

  const profiles = (tPlayers ?? []).map((tp: any) => tp.profiles).filter(Boolean);

  const sorted = (standings ?? []).slice().sort((a: any, b: any) => {
    if (b.points_for !== a.points_for) return b.points_for - a.points_for;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.points_for - b.points_against) - (a.points_for - a.points_against);
  });

  const m = MODALIDADES[tournament.modality as keyof typeof MODALIDADES] ?? MODALIDADES.custom;
  const fmtInfo = formatInfo(tournament.format);
  const isOwner = user?.id === tournament.created_by;
  const hasPairings = (pairings ?? []).length > 0;
  const isBracketFormat = ["single_elim", "double_elim"].includes(tournament.format ?? "rotation");
  const isRoundFormat = ["round_robin", "swiss"].includes(tournament.format ?? "rotation");

  return (
    <PageTransition>
      <div className="space-y-5">
        {/* Header card */}
        <section className="card">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{fmtInfo.icon}</span>
              <div>
                <h1 className="text-2xl font-bold">{tournament.name}</h1>
                <div className="text-text-mute text-sm mt-0.5 flex flex-wrap gap-2 items-center">
                  <span>{m.flag} {m.name} · {tournament.points_to_win} pts</span>
                  <span className="badge bg-surface-2 text-text-dim">{fmtInfo.name}</span>
                  {tournament.rated
                    ? <span className="badge bg-primary/15 text-primary">Rankeada</span>
                    : <span className="badge bg-surface-2 text-text-mute">Casual</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <VisibilityBadge v={tournament.visibility} />
              {tournament.status === "active" && isOwner && (tournament.format === "rotation" || tournament.format === "points_league") && (
                <Link href={`/matches/new?tournament=${id}`} className="btn-primary text-sm">
                  + Jugar partida
                </Link>
              )}
            </div>
          </div>

          {/* Owner actions for structured formats */}
          {isOwner && tournament.status === "active" && (isRoundFormat || isBracketFormat) && (
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
              {!hasPairings && (
                <GeneratePairingsButton tournamentId={id} />
              )}
              {hasPairings && isRoundFormat && tournament.format === "swiss" && (
                <GenerateNextRoundButton tournamentId={id} />
              )}
              {hasPairings && (isRoundFormat || isBracketFormat) && (
                <Link href={`/matches/new?tournament=${id}`} className="btn-ghost text-sm">
                  + Registrar partida
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Bracket (elim formats) */}
        {isBracketFormat && (
          <section className="card p-0 overflow-hidden">
            <h2 className="px-4 py-3 border-b border-border font-semibold">Bracket</h2>
            <div className="p-4">
              <Bracket
                pairings={(pairings ?? []) as any}
                profiles={profiles as any}
                tournamentId={id}
                isOwner={isOwner}
              />
            </div>
          </section>
        )}

        {/* Rounds (round_robin / swiss) */}
        {isRoundFormat && hasPairings && (
          <RoundsView pairings={pairings ?? []} profiles={profiles} tournamentId={id} isOwner={isOwner} />
        )}

        {/* Standings */}
        <section className="card p-0 overflow-hidden">
          <h2 className="px-4 py-3 border-b border-border font-semibold">
            {tournament.format === "points_league" ? "Tabla de puntos" : "Standings"}
          </h2>
          {sorted.length === 0 ? (
            <div className="p-6 text-center text-text-mute">Aún no se han jugado partidas en este torneo.</div>
          ) : (
            <div className="divide-y divide-border">
              {sorted.map((s: any, i: number) => (
                <div key={s.user_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-text-mute w-6 text-right text-sm font-mono">{i + 1}</span>
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

        {/* Match list (rotation / points_league always; others as reference) */}
        {(!isRoundFormat && !isBracketFormat) || (matches && matches.length > 0) ? (
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
                const teamArr = Object.entries(teams).sort(([a], [b]) => +a - +b);
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
        ) : null}
      </div>
    </PageTransition>
  );
}

function RoundsView({ pairings, profiles, tournamentId, isOwner }: {
  pairings: any[];
  profiles: any[];
  tournamentId: string;
  isOwner: boolean;
}) {
  const rounds = Array.from(new Set(pairings.map((p: any) => p.round))).sort((a, b) => a - b);
  return (
    <div className="space-y-4">
      {rounds.map((round) => {
        const rPairings = pairings.filter((p: any) => p.round === round);
        return (
          <section key={round} className="card p-0 overflow-hidden">
            <h2 className="px-4 py-3 border-b border-border font-semibold text-sm">Ronda {round}</h2>
            <div className="divide-y divide-border">
              {rPairings.map((p: any) => {
                const teamA = (p.team_a_user_ids ?? []).map((uid: string) =>
                  profiles.find((pr: any) => pr.id === uid)
                ).filter(Boolean);
                const teamB = (p.team_b_user_ids ?? []).map((uid: string) =>
                  profiles.find((pr: any) => pr.id === uid)
                ).filter(Boolean);
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <div className="flex -space-x-1.5">
                        {teamA.map((pl: any) => <Avatar key={pl.id} player={pl} size={24} />)}
                      </div>
                      <span className="text-sm text-text-dim truncate">
                        {teamA.map((pl: any) => pl.display_name || pl.username).join(" & ")}
                      </span>
                    </div>
                    <span className="text-text-mute text-sm font-medium">vs</span>
                    <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
                      <span className="text-sm text-text-dim truncate text-right">
                        {teamB.map((pl: any) => pl.display_name || pl.username).join(" & ")}
                      </span>
                      <div className="flex -space-x-1.5">
                        {teamB.map((pl: any) => <Avatar key={pl.id} player={pl} size={24} />)}
                      </div>
                    </div>
                    {p.match_id ? (
                      <Link href={`/matches/${p.match_id}`} className="text-xs text-primary hover:underline shrink-0">Ver →</Link>
                    ) : isOwner ? (
                      <Link href={`/matches/new?tournament=${tournamentId}&pairing=${p.id}`} className="text-xs text-text-mute hover:text-primary shrink-0">Jugar</Link>
                    ) : (
                      <span className="text-xs text-text-mute shrink-0">Pendiente</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function VisibilityBadge({ v }: { v: string }) {
  if (v === "public") return <span className="badge bg-info/15 text-info">🌍 Pública</span>;
  if (v === "friends") return <span className="badge bg-warning/15 text-warning">👥 Amigos</span>;
  return <span className="badge bg-surface-2 text-text-mute">🔒 Privada</span>;
}
