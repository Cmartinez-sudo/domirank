"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { useToast } from "@/components/Toast";
import {
  inviteToGroup,
  removeMember,
  promoteCoAdmin,
  demoteCoAdmin,
  cancelInvitation,
  leaveGroup,
} from "@/lib/groups";
import type { SearchedUser } from "@/lib/users";

type Member = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "admin" | "co_admin" | "member";
  joined_at: string | null;
  rating_display: number | null;
  is_rated: boolean;
};

type PendingInvitation = {
  invitation_id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

const ROLE_LABELS: Record<Member["role"], string> = {
  admin: "Admin",
  co_admin: "Co-admin",
  member: "Miembro",
};

const ROLE_STYLES: Record<Member["role"], string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  co_admin: "bg-info/15 text-info border-info/30",
  member: "bg-surface-3 text-text-mute border-border",
};

export function MembersPanel({
  groupId,
  members,
  pending,
  currentUserId,
  isAdminOrCo,
  isCreator,
}: {
  groupId: string;
  members: Member[];
  pending: PendingInvitation[];
  currentUserId: string;
  isAdminOrCo: boolean;
  isCreator: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const selfMember = members.find((m) => m.user_id === currentUserId);
  const selfRole = selfMember?.role;
  const otherActiveCount = members.filter((m) => m.user_id !== currentUserId).length;
  const isAdmin = selfRole === "admin";
  const isSoleAdmin = isAdmin && otherActiveCount === 0;
  const isBlockedAdmin = isAdmin && otherActiveCount > 0;
  const canLeave = !!selfRole && (!isAdmin || isSoleAdmin);

  const excludeIds = [
    ...members.map((m) => m.user_id),
    ...pending.map((p) => p.user_id),
  ];

  function handleInvite(u: SearchedUser) {
    setBusyId(u.id);
    startTransition(async () => {
      const r = await inviteToGroup({ groupId, userId: u.id });
      setBusyId(null);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`Invitación enviada a @${u.username}`);
        router.refresh();
      }
    });
  }

  function handleCancelInvitation(invitationId: string) {
    setBusyId(invitationId);
    startTransition(async () => {
      const r = await cancelInvitation({ invitationId });
      setBusyId(null);
      if (!r.ok) toast.error(r.error);
      else {
        toast.info("Invitación cancelada");
        router.refresh();
      }
    });
  }

  function handlePromote(m: Member) {
    setBusyId(m.user_id);
    startTransition(async () => {
      const r = await promoteCoAdmin({ groupId, userId: m.user_id });
      setBusyId(null);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`${m.display_name || m.username} ahora es co-admin`);
        router.refresh();
      }
    });
  }

  function handleDemote(m: Member) {
    setBusyId(m.user_id);
    startTransition(async () => {
      const r = await demoteCoAdmin({ groupId, userId: m.user_id });
      setBusyId(null);
      if (!r.ok) toast.error(r.error);
      else {
        toast.info(`${m.display_name || m.username} ya no es co-admin`);
        router.refresh();
      }
    });
  }

  function handleRemoveConfirm() {
    if (!removeTarget) return;
    const target = removeTarget;
    setBusyId(target.user_id);
    startTransition(async () => {
      const r = await removeMember({ groupId, userId: target.user_id });
      setBusyId(null);
      if (!r.ok) toast.error(r.error);
      else {
        toast.info(`${target.display_name || target.username} fue removido del grupo`);
        router.refresh();
      }
      setRemoveTarget(null);
    });
  }

  function handleLeaveConfirm() {
    setBusyId(currentUserId);
    startTransition(async () => {
      const r = await leaveGroup({ groupId });
      setBusyId(null);
      setLeaveOpen(false);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.data?.archived) {
        toast.info("Saliste del grupo y se archivó (eras el último miembro)");
      } else {
        toast.info("Saliste del grupo");
      }
      router.push("/groups");
    });
  }

  return (
    <div className="space-y-5">
      {/* Buscar para invitar */}
      {isAdminOrCo && (
        <section className="card">
          <h2 className="font-semibold text-sm mb-3">Invitar miembro</h2>
          <UserSearch
            excludeIds={excludeIds}
            placeholder="Buscar por @username o nombre…"
            onSelect={handleInvite}
          />
          <p className="text-text-mute text-xs mt-2">
            La persona recibirá una invitación que debe aceptar antes de unirse.
          </p>
        </section>
      )}

      {/* Lista de miembros activos */}
      <section className="space-y-2">
        <h2 className="font-semibold text-sm text-text-mute uppercase tracking-wider">
          Miembros activos ({members.length})
        </h2>
        <div className="space-y-2">
          {members.map((m) => {
            const isSelf = m.user_id === currentUserId;
            const isBusy = busyId === m.user_id;
            return (
              <div key={m.user_id} className="card flex items-center gap-3 flex-wrap">
                <Link
                  href={`/profile/${m.username}`}
                  className="flex items-center gap-3 flex-1 min-w-0 hover:text-primary"
                >
                  <Avatar player={m} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {m.display_name || m.username}
                      {isSelf && <span className="text-text-mute text-xs"> (vos)</span>}
                    </div>
                    <div className="text-text-mute text-xs">@{m.username}</div>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  {m.rating_display != null && m.is_rated && (
                    <span className="text-xs text-text-dim">
                      <span className="text-text-mute">DR</span>{" "}
                      <span className="font-mono font-bold text-primary tabular-nums">
                        {Number(m.rating_display).toFixed(1)}
                      </span>
                    </span>
                  )}
                  <span
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold border ${ROLE_STYLES[m.role]}`}
                  >
                    {ROLE_LABELS[m.role]}
                  </span>
                </div>

                {/* Acciones admin */}
                {!isSelf && isAdminOrCo && (
                  <div className="w-full flex gap-2 mt-2 sm:w-auto sm:mt-0">
                    {/* Promote/Demote: solo el creator. */}
                    {isCreator && m.role === "member" && (
                      <button
                        type="button"
                        onClick={() => handlePromote(m)}
                        disabled={isBusy}
                        className="btn-secondary !min-h-0 !py-1.5 !px-3 text-xs disabled:opacity-50"
                      >
                        Promover a co-admin
                      </button>
                    )}
                    {isCreator && m.role === "co_admin" && (
                      <button
                        type="button"
                        onClick={() => handleDemote(m)}
                        disabled={isBusy}
                        className="btn-secondary !min-h-0 !py-1.5 !px-3 text-xs disabled:opacity-50"
                      >
                        Quitar co-admin
                      </button>
                    )}
                    {/* Quitar: admin saca co_admin/member; co_admin solo member. */}
                    {m.role !== "admin" && (
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(m)}
                        disabled={isBusy}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Invitaciones pendientes — solo admin/co_admin */}
      {isAdminOrCo && pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold text-sm text-text-mute uppercase tracking-wider">
            Invitaciones pendientes ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((p) => {
              const isBusy = busyId === p.invitation_id;
              return (
                <div key={p.invitation_id} className="card flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar player={p} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">
                        {p.display_name || p.username}
                      </div>
                      <div className="text-text-mute text-xs">@{p.username}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCancelInvitation(p.invitation_id)}
                    disabled={isBusy}
                    className="btn-secondary !min-h-0 !py-1.5 !px-3 text-xs disabled:opacity-50"
                  >
                    Cancelar invitación
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Salir del grupo — visible para todo miembro. Admin único puede salir
          y auto-archiva; admin con otros miembros ve un hint para transferir. */}
      {selfRole && (
        <section className="card border-danger/20">
          <h2 className="font-semibold text-sm mb-2">Salir del grupo</h2>
          {isBlockedAdmin ? (
            <p className="text-text-mute text-xs">
              Eres el admin. Para salir, primero transfiere el rol de admin a otro miembro
              desde <Link href={`/groups/${groupId}/settings`} className="text-primary underline">Ajustes</Link>.
            </p>
          ) : isSoleAdmin ? (
            <>
              <p className="text-text-mute text-xs mb-3">
                Eres el último miembro del grupo. Al salir, el grupo se archivará. Tu historial se conserva.
              </p>
              <button
                type="button"
                onClick={() => setLeaveOpen(true)}
                disabled={busyId === currentUserId}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
              >
                Salir y archivar grupo
              </button>
            </>
          ) : canLeave ? (
            <>
              <p className="text-text-mute text-xs mb-3">
                Dejarás de ver el leaderboard y las partidas nuevas. Tu historial se conserva.
              </p>
              <button
                type="button"
                onClick={() => setLeaveOpen(true)}
                disabled={busyId === currentUserId}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
              >
                Salir del grupo
              </button>
            </>
          ) : null}
        </section>
      )}

      <ConfirmDangerDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveConfirm}
        title={`¿Quitar a ${removeTarget?.display_name || removeTarget?.username} del grupo?`}
        description="Dejará de ver el leaderboard y partidas nuevas. Sus partidas históricas en el grupo se conservan."
        confirmLabel="Sí, quitar"
        pending={busyId === removeTarget?.user_id}
      />

      <ConfirmDangerDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={handleLeaveConfirm}
        title={isSoleAdmin ? "¿Salir y archivar el grupo?" : "¿Salir del grupo?"}
        description={
          isSoleAdmin
            ? "Eres el último miembro. Al salir, el grupo se archiva. Tu historial se conserva."
            : "Dejarás de ver el leaderboard y las partidas nuevas. Tu historial se conserva."
        }
        confirmLabel={isSoleAdmin ? "Sí, salir y archivar" : "Sí, salir"}
        pending={busyId === currentUserId}
      />
    </div>
  );
}
