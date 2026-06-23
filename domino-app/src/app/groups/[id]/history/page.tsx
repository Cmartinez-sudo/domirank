import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { requireUser } from "@/lib/auth";
import { getGroupDetails, getGroupMatchHistory } from "@/lib/groups-queries";
import { ImportHistoricalButton } from "./ImportHistoricalButton";

export const dynamic = "force-dynamic";

export default async function GroupHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const group = await getGroupDetails(id);
  if (!group) notFound();

  const history = await getGroupMatchHistory(id, { limit: 50 });
  const isAdminOrCo = group.my_role === "admin" || group.my_role === "co_admin";

  return (
    <div className="space-y-4">
      {isAdminOrCo && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-text-mute text-sm">
            Partidas confirmadas atribuidas al grupo.
          </p>
          <ImportHistoricalButton groupId={id} />
        </div>
      )}

      {history.length === 0 ? (
        <div className="card text-center py-12 text-text-mute">
          <p>Aún no hay partidas en el historial.</p>
          {isAdminOrCo && (
            <p className="text-xs mt-1">
              Si tus miembros ya jugaron antes, podés importar el historial con
              el botón de arriba.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((m) => {
            const team1 = m.players.filter((p) => p.team === 1);
            const team2 = m.players.filter((p) => p.team === 2);
            const team1Won = team1.some((p) => p.rank === 1);
            const date = new Date(m.finished_at ?? m.created_at);
            return (
              <Link
                key={m.match_id}
                href={`/matches/${m.match_id}`}
                className="card block hover:border-border-strong transition-colors"
              >
                <div className="flex items-center gap-3 text-xs text-text-mute mb-2 flex-wrap">
                  <span>{date.toLocaleDateString("es")}</span>
                  <span>·</span>
                  <span>a {m.target_points} pts</span>
                  {m.modality && (
                    <>
                      <span>·</span>
                      <span className="uppercase">{m.modality}</span>
                    </>
                  )}
                  {!m.rated && (
                    <span className="badge bg-info/15 text-info text-[10px]">
                      Amistosa
                    </span>
                  )}
                  {m.attribution_type === "retroactive" && (
                    <span className="badge bg-surface-3 text-text-mute text-[10px]">
                      Importada
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <TeamRow players={team1} winner={team1Won} label="Equipo A" />
                  <TeamRow players={team2} winner={!team1Won} label="Equipo B" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamRow({
  players,
  winner,
  label,
}: {
  players: Array<{ user_id: string; username: string; display_name: string | null; avatar_url: string | null }>;
  winner: boolean;
  label: string;
}) {
  return (
    <div
      className={`p-2.5 rounded-lg ${winner ? "bg-primary/10 border border-primary/30" : "bg-surface-2 border border-border"}`}
    >
      <div className={`text-[10px] font-bold uppercase tracking-wider ${winner ? "text-primary" : "text-text-mute"}`}>
        {label} {winner && "· Ganó"}
      </div>
      <div className="mt-1 space-y-1">
        {players.map((p) => (
          <div key={p.user_id} className="flex items-center gap-2 text-sm min-w-0">
            <Avatar player={p} size={24} />
            <span className="truncate">{p.display_name || p.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
