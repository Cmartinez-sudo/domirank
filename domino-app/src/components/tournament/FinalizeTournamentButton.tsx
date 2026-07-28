"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { setTournamentStatus } from "@/lib/tournaments";

/**
 * Botón grande para que el organizador finalice el torneo cuando todas
 * las partidas están confirmed. Confirma con un dialog antes de aplicar
 * (setear status='finished' es reversible via 'in_progress' pero mejor
 * evitar clicks accidentales).
 */
export function FinalizeTournamentButton({ tournamentId }: { tournamentId: string }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const r = await setTournamentStatus(tournamentId, "finished");
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("¡Torneo finalizado!");
        router.refresh();
      }
      setShowConfirm(false);
    });
  }

  if (!showConfirm) {
    return (
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="w-full btn-primary text-base py-3 font-semibold"
      >
        🏆 Finalizar torneo
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
      <p className="text-sm">
        ¿Finalizar el torneo? Después se muestra el summary con todas las
        rondas y no se pueden agregar más partidas.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="btn-primary text-sm flex-1 disabled:opacity-50"
        >
          {pending ? "Finalizando…" : "Sí, finalizar"}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          disabled={pending}
          className="btn-ghost text-sm flex-1"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
