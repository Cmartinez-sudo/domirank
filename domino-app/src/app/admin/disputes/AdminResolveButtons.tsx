"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { adminResolveMatch } from "@/lib/admin-actions";
import { applyMatchRating } from "@/lib/match-attest-actions";

export function AdminResolveButtons({ matchId }: { matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function resolve(action: "confirm" | "void") {
    if (!confirm(action === "confirm" ? "¿Confirmar este resultado y aplicar al rating?" : "¿Marcar como anulada (no afecta rating)?")) return;
    setPending(true);
    const r = await adminResolveMatch(matchId, action);
    if (!r.ok) {
      toast.error(r.error);
      setPending(false);
      return;
    }
    if (action === "confirm") {
      // Aplica rating en el mismo request
      const ar = await applyMatchRating(matchId);
      if (!ar.ok) toast.error(`Confirmada pero rating no aplicado: ${ar.error}`);
      else toast.success("Confirmada · rating aplicado");
    } else {
      toast.success("Partida anulada");
    }
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="btn-primary text-sm py-1.5 px-3"
        disabled={pending}
        onClick={() => resolve("confirm")}
      >
        {pending ? "…" : "Confirmar"}
      </button>
      <button
        type="button"
        className="btn-ghost text-sm py-1.5 px-3 text-text-mute hover:text-danger"
        disabled={pending}
        onClick={() => resolve("void")}
      >
        Anular
      </button>
    </div>
  );
}
