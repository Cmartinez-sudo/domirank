"use client";

import { useState } from "react";
import { voidMatch } from "./actions";

export function VoidMatchButton({ matchId }: { matchId: string }) {
  const [open, setOpen]       = useState(false);
  const [pending, setPending] = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  async function confirm() {
    setPending(true);
    setErr(null);
    const res = await voidMatch(matchId);
    if (!res.ok) {
      setErr(res.error);
      setPending(false);
    }
    // On success the page re-renders via revalidatePath — no redirect needed
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

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold">¿Anular esta partida?</h2>
            <p className="text-text-dim text-sm">
              Los ratings de todos los jugadores volverán a los valores anteriores a la partida.
              Esta acción no se puede deshacer.
            </p>
            {err && <p className="text-danger text-sm">{err}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={() => { setOpen(false); setErr(null); }}
                disabled={pending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary flex-1 bg-danger/90 hover:bg-danger shadow-none"
                onClick={confirm}
                disabled={pending}
              >
                {pending ? "Anulando…" : "Sí, anular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
