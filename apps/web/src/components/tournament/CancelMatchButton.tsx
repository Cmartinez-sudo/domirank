"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { useToast } from "@/components/Toast";
import { cancelTournamentMatch } from "@/lib/tournaments";

/**
 * Botón compacto para que el organizador cancele una partida en curso o
 * pendiente de attestation. Aparece en cada fila de RoundsView.
 * Confirmación destructiva antes de actuar.
 */
export function CancelMatchButton({
  tournamentId,
  matchId,
}: {
  tournamentId: string;
  matchId: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const r = await cancelTournamentMatch(tournamentId, matchId);
      setOpen(false);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Partida cancelada");
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Cancelar partida"
        className="text-xs text-text-mute hover:text-danger shrink-0 px-1"
      >
        ✕
      </button>
      <ConfirmDangerDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="¿Cancelar esta partida?"
        description="La partida queda como cancelada y no afecta el standing. Podés volver a jugarla desde la lista."
        confirmLabel="Sí, cancelar"
        pending={pending}
      />
    </>
  );
}
