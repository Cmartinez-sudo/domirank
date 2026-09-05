"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDangerDialog } from "@/components/ConfirmDangerDialog";
import { useToast } from "@/components/Toast";
import { setTournamentStatus } from "@/lib/tournaments";

/**
 * Botón para que el organizador cancele el torneo.
 * Estado 'cancelled' es final (no reversible desde UI). Se puede recuperar
 * manualmente vía service_role si fuera error.
 */
export function CancelTournamentButton({ tournamentId }: { tournamentId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const r = await setTournamentStatus(tournamentId, "cancelled");
      setOpen(false);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Torneo cancelado");
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-danger hover:bg-danger/10 border border-danger/30 rounded-xl px-3 py-1.5"
      >
        Cancelar torneo
      </button>
      <ConfirmDangerDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={handleConfirm}
        title="¿Cancelar torneo?"
        description="Se detiene el torneo y no se podrán registrar más partidas. Las partidas ya jugadas y el standing actual se conservan. Esta acción no se puede deshacer."
        confirmLabel="Sí, cancelar torneo"
        pending={pending}
      />
    </>
  );
}
