"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";

type AttributionProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type HandRowData = {
  id: number;
  round_number: number;
  team: number;
  points: number;
  kind: string; // 'points' | 'capicua' | 'tranque'
  recorded_at: string;
  recorded_by: AttributionProfile | null;
  last_edited_at: string | null;
  last_edited_by: AttributionProfile | null;
  edit_count: number;
  attestation_status: "pending" | "approved" | "rejected" | null;
};

type Props = {
  hand: HandRowData;
  /** Team A display name (rendered when hand.team === 1). */
  nameA: string;
  /** Team B display name (rendered when hand.team === 2). */
  nameB: string;
  /** Optional callback for opening edit modal (sprint C6). */
  onEdit?: (handId: number) => void;
  /** When true, parent treats viewer as spectator → hide edit affordance. */
  canEdit?: boolean;
};

/**
 * One row per "mano" (round) in a live match. Spec C4:
 *   - Default: clean — solo `#N`, jugador/equipo, points, signals.
 *   - Tap row → expande atribución debajo (avatar + nombre + tiempo
 *     relativo). Mismo tap colapsa.
 *   - Mano editada: icon ámbar SIEMPRE visible (excepción al clean
 *     default — el hecho de la edición ES la información relevante).
 *   - Attestation pendiente: badge "Pendiente" siempre visible.
 *
 * No mostramos atribución por default (clean UI principle).
 */
export function HandRow({ hand, nameA, nameB, onEdit, canEdit = true }: Props) {
  const [open, setOpen] = useState(false);
  const wasEdited = hand.edit_count > 0 && hand.last_edited_at != null;
  const pending = hand.attestation_status === "pending";

  const teamName = hand.team === 1 ? nameA : nameB;
  const teamClass = hand.team === 1 ? "text-teamA" : "text-teamB";

  return (
    <div className="border-t border-border/40 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Mano ${hand.round_number}. Toca para ver atribución.`}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-surface-2/60 transition-colors"
      >
        <span className="text-text-mute font-mono tabular-nums w-8 text-left">
          #{hand.round_number}
        </span>

        <span className={`${teamClass} font-medium flex-1 text-left ml-2 truncate`}>
          {teamName}
        </span>

        <span className="font-mono font-semibold tabular-nums shrink-0">
          {hand.kind === "tranque" ? "—" : `+${hand.points}`}
          {hand.kind === "capicua" && (
            <span className="text-warning ml-1 text-xs">capicúa</span>
          )}
        </span>

        {/* Edited indicator — siempre visible si fue editada */}
        {wasEdited && (
          <span
            className="ml-2 text-warning shrink-0"
            title={`Editada ${hand.edit_count} ${hand.edit_count === 1 ? "vez" : "veces"}`}
            aria-label="Mano editada"
          >
            <EditIcon />
          </span>
        )}

        {/* Pending attestation badge — siempre visible si pending */}
        {pending && (
          <span className="ml-2 inline-flex items-center text-[10px] uppercase tracking-wider font-semibold bg-warning/15 text-warning px-1.5 py-0.5 rounded shrink-0">
            Pendiente
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 text-xs text-text-dim bg-surface-2/30 border-t border-border/30">
          {hand.recorded_by ? (
            <AttributionLine
              prefix="Registrada por"
              profile={hand.recorded_by}
              when={hand.recorded_at}
            />
          ) : (
            <div className="text-text-mute italic">Autor desconocido (mano legacy).</div>
          )}

          {wasEdited && hand.last_edited_by && hand.last_edited_at && (
            <>
              <div className="my-1.5 h-px bg-border/30" />
              <AttributionLine
                prefix="Editada por"
                profile={hand.last_edited_by}
                when={hand.last_edited_at}
                edited
              />
            </>
          )}

          {canEdit && onEdit && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(hand.id); }}
                className="text-primary text-xs font-medium hover:underline"
              >
                Editar mano →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AttributionLine({ prefix, profile, when, edited = false }: {
  prefix: string;
  profile: AttributionProfile;
  when: string;
  edited?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar player={profile} size={18} />
      <span className={edited ? "text-warning" : "text-text-dim"}>{prefix}</span>
      <strong className="text-text">{profile.display_name ?? profile.username}</strong>
      <span className="text-text-mute">·</span>
      <span className="text-text-mute font-mono tabular-nums">{formatRelative(when)}</span>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60)     return "hace un momento";
  if (diffSec < 3600)   return `hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400)  return `hace ${Math.floor(diffSec / 3600)} h`;
  return `hace ${Math.floor(diffSec / 86400)} d`;
}
