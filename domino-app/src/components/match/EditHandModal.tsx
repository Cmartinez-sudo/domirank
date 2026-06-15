"use client";

import { useEffect, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { checkEditHandPermission, editHandDirect, proposeHandEdit, type EditCheck } from "@/lib/hand-edits";

type Hand = {
  id: number;
  round_number: number;
  team: number;
  points: number;
  kind: "points" | "capicua" | "tranque";
};

type Props = {
  open: boolean;
  hand: Hand | null;
  matchId: string;
  nameA: string;
  nameB: string;
  onClose: () => void;
};

/**
 * Edit hand modal — Spec C6.
 *
 * Three scenarios based on `can_edit_hand(round_id, user_id)` returned
 * by `checkEditHandPermission`:
 *
 *   A. allowed=true, reason='author_within_window' → direct edit modal,
 *      no warning. Calls editHandDirect.
 *   B. allowed=true, reason='host_override' → direct edit modal with
 *      warning "Estás editando una mano de otro jugador. Quedará registro".
 *      Calls editHandDirect (last_edited_by stamped automatically).
 *   C. allowed=false, reason='requires_attestation' → "Proponer corrección"
 *      modal. Calls proposeHandEdit → dispara flow de attestation
 *      (1 confirm extra needed; rejection cancels).
 */
export function EditHandModal({ open, hand, matchId, nameA, nameB, onClose }: Props) {
  const [perm, setPerm] = useState<EditCheck | null>(null);
  const [team, setTeam] = useState<number>(hand?.team ?? 1);
  const [points, setPoints] = useState<number>(hand?.points ?? 0);
  const [kind, setKind] = useState<"points" | "capicua" | "tranque">(hand?.kind ?? "points");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar permission cuando se abre o cambia la mano.
  useEffect(() => {
    if (!open || !hand) {
      setPerm(null);
      return;
    }
    setError(null);
    setSuccess(null);
    setTeam(hand.team);
    setPoints(hand.points);
    setKind(hand.kind);
    checkEditHandPermission(hand.id).then(setPerm);
  }, [open, hand?.id]);

  if (!open || !hand) return null;

  const isDirect = perm?.allowed === true;
  const isHost = perm?.allowed && perm.reason === "host_override";
  const isProposal = perm?.allowed === false && perm.reason === "requires_attestation";

  const title = isProposal ? "Proponer corrección" : `Editar mano #${hand.round_number}`;

  function handleSubmit() {
    if (!hand) return;
    setError(null);
    startTransition(async () => {
      if (isDirect) {
        const r = await editHandDirect(matchId, hand.id, { team, points, kind });
        if (!r.ok) { setError(r.error); return; }
        setSuccess("Mano actualizada");
        setTimeout(onClose, 800);
      } else if (isProposal) {
        const r = await proposeHandEdit(matchId, hand.id, { team, points, kind });
        if (!r.ok) { setError(r.error); return; }
        setSuccess("Propuesta enviada. Otros jugadores deben confirmar.");
        setTimeout(onClose, 1200);
      } else {
        setError(perm?.reason ?? "No autorizado");
      }
    });
  }

  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={isProposal
        ? "Pasaron más de 5 min y no eres el creador. Tu cambio necesita 1 confirmación más de otro jugador para aplicarse."
        : isHost
        ? "Estás editando una mano de otro jugador. Quedará registro de quién editó."
        : "Estás editando tu propia mano."}
      confirmLabel={isProposal ? "Enviar propuesta" : "Guardar"}
      cancelLabel="Cancelar"
      pending={pending}
      onCancel={onClose}
      onConfirm={handleSubmit}
    >
      <div className="space-y-3 mt-3">
        <div>
          <label className="text-xs text-text-mute">Equipo</label>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => setTeam(1)}
              className={`flex-1 py-2 rounded border ${team === 1 ? "bg-teamA/15 border-teamA text-teamA" : "bg-surface-2 border-border text-text-dim"}`}
            >
              {nameA}
            </button>
            <button
              type="button"
              onClick={() => setTeam(2)}
              className={`flex-1 py-2 rounded border ${team === 2 ? "bg-teamB/15 border-teamB text-teamB" : "bg-surface-2 border-border text-text-dim"}`}
            >
              {nameB}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-text-mute">Puntos</label>
          <input
            type="number"
            min={0}
            max={500}
            value={points}
            onChange={(e) => setPoints(parseInt(e.target.value, 10) || 0)}
            className="w-full mt-1 px-3 py-2 bg-surface-2 border border-border rounded font-mono tabular-nums text-lg"
          />
        </div>

        <div>
          <label className="text-xs text-text-mute">Tipo</label>
          <div className="flex gap-2 mt-1">
            {(["points", "capicua", "tranque"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`px-3 py-1.5 rounded border text-xs ${kind === k ? "border-primary text-primary bg-primary/10" : "bg-surface-2 border-border text-text-dim"}`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-2 bg-danger/10 border border-danger/30 rounded text-danger text-xs">
            {error}
          </div>
        )}
        {success && (
          <div className="p-2 bg-primary/10 border border-primary/30 rounded text-primary text-xs">
            {success}
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}
