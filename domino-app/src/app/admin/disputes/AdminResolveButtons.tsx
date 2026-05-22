"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { adminResolveMatch } from "@/lib/admin-actions";

export function AdminResolveButtons({ matchId }: { matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [askingAction, setAskingAction] = useState<"confirm" | "void" | null>(null);

  async function doResolve(action: "confirm" | "void") {
    setAskingAction(null);
    setPending(true);
    const r = await adminResolveMatch(matchId, action);
    setPending(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(action === "confirm" ? "Confirmada · rating aplicado" : "Partida anulada");
    router.refresh();
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary text-sm py-1.5 px-3"
          disabled={pending}
          onClick={() => setAskingAction("confirm")}
        >
          {pending ? "…" : "Confirmar"}
        </button>
        <button
          type="button"
          className="btn-ghost text-sm py-1.5 px-3 text-text-mute hover:text-danger"
          disabled={pending}
          onClick={() => setAskingAction("void")}
        >
          Anular
        </button>
      </div>

      <ConfirmDialog
        open={askingAction === "confirm"}
        title="¿Confirmar este resultado?"
        description="El rating de los 4 jugadores se aplicará al instante."
        confirmLabel="Sí, confirmar"
        onConfirm={() => doResolve("confirm")}
        onCancel={() => setAskingAction(null)}
        pending={pending}
      />
      <ConfirmDialog
        open={askingAction === "void"}
        title="¿Anular esta partida?"
        description="Quedará marcada como no contar. No afectará el rating de nadie."
        confirmLabel="Sí, anular"
        destructive
        onConfirm={() => doResolve("void")}
        onCancel={() => setAskingAction(null)}
        pending={pending}
      />
    </>
  );
}
