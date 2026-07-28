"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { advanceToNextCiclo } from "@/lib/tournaments";

/**
 * Botón para que el organizador pase al siguiente ciclo en RR Individual.
 * Aparece solo cuando el ciclo actual está completo y quedan más ciclos.
 */
export function AdvanceCicloButton({
  tournamentId,
  currentCiclo,
  totalCiclos,
}: {
  tournamentId: string;
  currentCiclo: number;
  totalCiclos: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const r = await advanceToNextCiclo(tournamentId);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(`Ahora estás en el ciclo ${r.newCiclo} de ${totalCiclos}`);
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="btn-primary text-sm disabled:opacity-50"
    >
      {pending ? "Avanzando…" : `Pasar al ciclo ${currentCiclo + 1}`}
    </button>
  );
}
