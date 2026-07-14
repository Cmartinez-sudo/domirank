import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listMyGroups, listMyInvitations } from "@/lib/groups-queries";
import { GroupCard } from "./GroupCard";
import { InvitationCard } from "./InvitationCard";

export const dynamic = "force-dynamic";

// TEMPORARY DEBUG — try/catch cada paso y renderear el mensaje si crashea.
// TODO: remover una vez identificado el bug.
function isRedirectError(err: unknown): boolean {
  // Next.js throws these exceptions internally to signal redirect/notFound.
  // NO deben ser capturadas — dejar propagar para que Next las maneje.
  if (!(err instanceof Error)) return false;
  const msg = err.message || "";
  return msg === "NEXT_REDIRECT" || msg === "NEXT_NOT_FOUND" || (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT") === true;
}

function renderDebugError(where: string, err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err));
  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 space-y-2 text-sm">
      <div className="text-red-400 font-bold text-base">
        Debug: crash en {where}
      </div>
      <div className="font-mono text-xs bg-black/40 p-3 rounded whitespace-pre-wrap break-all">
        <strong>Message:</strong> {e.message || "(empty)"}
      </div>
      {e.stack && (
        <details open>
          <summary className="cursor-pointer text-red-300 text-xs">Stack</summary>
          <pre className="text-[10px] overflow-auto max-h-96 mt-1 bg-black/40 p-2 rounded">
            {e.stack}
          </pre>
        </details>
      )}
    </div>
  );
}

export default async function GroupsPage() {
  try {
    await requireUser();
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return renderDebugError("requireUser()", e);
  }

  let groups: Awaited<ReturnType<typeof listMyGroups>>;
  let invitations: Awaited<ReturnType<typeof listMyInvitations>>;

  try {
    groups = await listMyGroups();
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return renderDebugError("listMyGroups()", e);
  }

  try {
    invitations = await listMyInvitations();
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return renderDebugError("listMyInvitations()", e);
  }

  try {
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

        {/* Debug info */}
        <div className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 p-2 text-xs font-mono text-emerald-300">
          ✓ requireUser OK · groups: {groups.length} · invitations: {invitations.length}
        </div>

        {/* Mis grupos */}
        {groups.length === 0 ? (
          <div className="card text-center py-12 px-6">
            <h2 className="text-xl font-bold mb-2">Tu primer grupo te espera</h2>
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

        {invitations.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold">
              Invitaciones pendientes{" "}
              <span className="text-text-mute font-normal">({invitations.length})</span>
            </h2>
            <div className="space-y-3">
              {invitations.map((inv) => (
                <InvitationCard key={inv.id} invitation={inv} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return renderDebugError("JSX render", e);
  }
}
