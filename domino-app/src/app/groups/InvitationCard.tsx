"use client";

import { useState, useTransition } from "react";
import type { GroupInvitation } from "@/lib/groups-queries";
import { acceptInvitation, rejectInvitation } from "@/lib/groups";
import { useToast } from "@/components/Toast";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";

export function InvitationCard({ invitation }: { invitation: GroupInvitation }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  const inviterName =
    invitation.invited_by_display_name || invitation.invited_by_username || "Alguien";

  function handleAccept() {
    startTransition(async () => {
      const r = await acceptInvitation({ invitationId: invitation.id });
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`Te uniste al grupo ${invitation.group_name}`);
        setHidden(true);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      const r = await rejectInvitation({ invitationId: invitation.id });
      setConfirmReject(false);
      if (!r.ok) toast.error(r.error);
      else {
        toast.info("Invitación rechazada");
        setHidden(true);
      }
    });
  }

  if (hidden) return null;

  return (
    <>
      <div className="card">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{invitation.group_name}</div>
            <div className="text-text-mute text-xs mt-1">
              {inviterName} te invitó a unirte al grupo.
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmReject(true)}
              disabled={pending}
              className="btn-secondary !min-h-0 !py-2 !px-3 text-sm disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={pending}
              className="btn-primary !min-h-0 !py-2 !px-3 text-sm disabled:opacity-50"
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>

      <ConfirmDangerDialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        onConfirm={handleReject}
        title={`¿Rechazar la invitación a ${invitation.group_name}?`}
        description="Esta acción no se puede deshacer. Si te arrepientes, el admin tendría que invitarte de nuevo."
        confirmLabel="Sí, rechazar"
        pending={pending}
      />
    </>
  );
}
