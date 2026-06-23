import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { getGroupDetails } from "@/lib/groups-queries";

export const dynamic = "force-dynamic";

type LeaderboardRow = {
  group_id: string;
  user_id: string;
  matches_played: number;
  wins: number;
  losses: number;
  effectiveness_coefficient: number;
  effectiveness_percent: number;
  points_for: number;
  points_against: number;
  rank: number;
};

export default async function GroupLeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const group = await getGroupDetails(id);
  if (!group) notFound();

  const supabase = await supabaseServer();
  const { data: rowsRaw } = await supabase
    .from("group_leaderboard")
    .select("*")
    .eq("group_id", id)
    .order("rank", { ascending: true });

  const rows = (rowsRaw as LeaderboardRow[] | null) ?? [];

  // Profiles para mostrar avatar/username (no vienen en la view).
  const userIds = rows.map((r) => r.user_id);
  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds);
    for (const p of (profiles ?? []) as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>) {
      profileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
    }
  }

  return (
    <div className="card overflow-x-auto p-0">
      {rows.length === 0 ? (
        <div className="text-center py-12 text-text-mute">
          <p>Aún no hay partidas en el grupo.</p>
          <p className="text-xs mt-1">
            Cuando una partida con los 4 jugadores como miembros se confirme,
            aparecerá aquí.
          </p>
        </div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left text-text-mute text-xs uppercase tracking-wider border-b border-border">
              <th className="px-4 py-3 w-12">#</th>
              <th className="px-4 py-3">Jugador</th>
              <th className="px-4 py-3 text-right">PJ</th>
              <th className="px-4 py-3 text-right">V</th>
              <th className="px-4 py-3 text-right">D</th>
              <th className="px-4 py-3 text-right" title="Coeficiente de Eficiencia (federado)">
                CE
              </th>
              <th className="px-4 py-3 text-right hidden md:table-cell" title="Eficiencia % (display)">
                Efic
              </th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">Pts+</th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">Pts−</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const profile = profileMap.get(r.user_id) ?? {
                username: "?",
                display_name: null,
                avatar_url: null,
              };
              return (
                <tr
                  key={r.user_id}
                  className="border-b border-border/50 hover:bg-surface-2/60 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                        r.rank === 1
                          ? "bg-yellow-400/15 text-yellow-400"
                          : r.rank === 2
                            ? "bg-slate-300/15 text-slate-300"
                            : r.rank === 3
                              ? "bg-amber-600/15 text-amber-500"
                              : "text-text-mute"
                      }`}
                    >
                      {r.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/profile/${profile.username}`}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      <Avatar player={profile} size={32} />
                      <div>
                        <div className="font-medium">
                          {profile.display_name || profile.username}
                        </div>
                        <div className="text-text-mute text-xs">@{profile.username}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.matches_played}</td>
                  <td className="px-4 py-3 text-right font-mono text-primary">{r.wins}</td>
                  <td className="px-4 py-3 text-right font-mono text-danger">{r.losses}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {Number(r.effectiveness_coefficient).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-text-dim">
                    {Number(r.effectiveness_percent).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell font-mono text-text-dim">
                    {r.points_for}
                  </td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell font-mono text-text-dim">
                    {r.points_against}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="text-text-mute text-[11px] text-center py-3 border-t border-border/50">
        Orden federado: <span className="font-mono">V → CE → Pts+</span>. CE =
        coeficiente de eficiencia (cuánto te acercaste a la meta vs tu rival).
      </p>
    </div>
  );
}
