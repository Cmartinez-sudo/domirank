"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { voidMatch } from "./actions";

export function VoidMatchButton({ matchId }: { matchId: string }) {
  const [open, setOpen]       = useState(false);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function doVoid() {
    setPending(true);
    const res = await voidMatch(matchId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOpen(false);
    toast.success("Partida anulada. Ratings revertidos.");
    // Page re-renderea via revalidatePath
  }

  return (
    <>
      <button
        type="button"
        className="btn-ghost text-sm text-danger border-danger/30 hover:bg-danger/10"
        onClick={() => setOpen(true)}
      >
        Anular partida
      </button>

      <ConfirmDialog
        open={open}
        title="¿Anular esta partida?"
        description="Los ratings de todos los jugadores volverán a los valores anteriores. Esta acción no se puede deshacer."
        confirmLabel="Sí, anular"
        destructive
        pending={pending}
        onConfirm={doVoid}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
