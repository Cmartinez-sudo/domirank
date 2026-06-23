import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listMyGroups, listMyInvitations } from "@/lib/groups-queries";
import { GroupCard } from "./GroupCard";
import { InvitationCard } from "./InvitationCard";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  await requireUser();

  const [groups, invitations] = await Promise.all([
    listMyGroups(),
    listMyInvitations(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Grupos</h1>
          <p className="text-text-mute text-sm mt-1">
            Crews donde compartís historial de partidas.
          </p>
        </div>
        <Link href="/groups/new" className="btn-primary">
          + Crear grupo
        </Link>
      </div>

      {/* Mis grupos */}
      {groups.length === 0 ? (
        <div className="card text-center py-12 px-6">
          <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
              aria-hidden="true"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Tu primer grupo te espera</h2>
          <p className="text-text-dim text-sm max-w-sm mx-auto">
            Los grupos son crews que comparten leaderboard e historial. Ideal
            para tu crew habitual de dominó.
          </p>
          <ul className="text-text-mute text-sm mt-4 space-y-1.5 text-left max-w-xs mx-auto">
            <li className="flex gap-2">
              <span className="text-primary">·</span> Leaderboard federado del crew
            </li>
            <li className="flex gap-2">
              <span className="text-primary">·</span> Historial de partidas atribuido auto
            </li>
            <li className="flex gap-2">
              <span className="text-primary">·</span> Hasta 100 miembros
            </li>
          </ul>
          <Link href="/groups/new" className="btn-primary mt-6 inline-block">
            Crear tu primer grupo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}

      {/* Invitaciones pendientes — inline (decisión F4-5 = b) */}
      {invitations.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Invitaciones pendientes{" "}
              <span className="text-text-mute font-normal">({invitations.length})</span>
            </h2>
          </div>
          <div className="space-y-3">
            {invitations.map((inv) => (
              <InvitationCard key={inv.id} invitation={inv} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
