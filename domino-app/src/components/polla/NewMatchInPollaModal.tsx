"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNewMatchInPolla } from "@/lib/polla-actions";

type Props = {
  tournamentId: string;
  rosterUserIds: string[];
  userNames: Record<string, string>;
  currentUserId: string;
  onClose: () => void;
};

type Slot = "a1" | "a2" | "b1" | "b2";

export function NewMatchInPollaModal({
  tournamentId, rosterUserIds, userNames, currentUserId, onClose,
}: Props) {
  const router = useRouter();
  const [slots, setSlots] = useState<Record<Slot, string | null>>({
    a1: currentUserId, a2: null, b1: null, b2: null,
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usedIds = new Set(Object.values(slots).filter((v): v is string => v !== null));
  const teamA = [slots.a1, slots.a2].filter((v): v is string => v !== null);
  const teamB = [slots.b1, slots.b2].filter((v): v is string => v !== null);
  const ready = teamA.length === 2 && teamB.length === 2;

  function setSlot(slot: Slot, userId: string | null) {
    setSlots((cur) => ({ ...cur, [slot]: userId }));
  }

  async function handleStart() {
    if (!ready) return;
    setPending(true);
    setError(null);
    const res = await createNewMatchInPolla({
      tournament_id: tournamentId,
      team_a: teamA as [string, string],
      team_b: teamB as [string, string],
    });
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    onClose();
    router.push(`/matches/${res.match_id}/live`);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-bg w-full sm:max-w-md sm:rounded-2xl border-t sm:border border-border p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Nueva partida en la polla</h2>

        <TeamPicker
          label="Pareja A"
          slots={["a1", "a2"]}
          slotValues={slots}
          roster={rosterUserIds}
          userNames={userNames}
          usedIds={usedIds}
          onSet={setSlot}
        />

        <TeamPicker
          label="Pareja B"
          slots={["b1", "b2"]}
          slotValues={slots}
          roster={rosterUserIds}
          userNames={userNames}
          usedIds={usedIds}
          onSet={setSlot}
        />

        <p className="text-text-mute text-xs">Cualquier combinación está permitida.</p>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="btn-primary flex-1"
            disabled={!ready || pending}
          >
            {pending ? "Creando…" : "Empezar partida →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamPicker({
  label, slots, slotValues, roster, userNames, usedIds, onSet,
}: {
  label: string;
  slots: Slot[];
  slotValues: Record<Slot, string | null>;
  roster: string[];
  userNames: Record<string, string>;
  usedIds: Set<string>;
  onSet: (slot: Slot, userId: string | null) => void;
}) {
  return (
    <div>
      <div className="text-text-mute text-xs uppercase tracking-wide mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot) => (
          <select
            key={slot}
            value={slotValues[slot] ?? ""}
            onChange={(e) => onSet(slot, e.target.value || null)}
            className="card p-2.5 text-sm w-full"
            aria-label={`${label} jugador ${slot.endsWith("1") ? "1" : "2"}`}
          >
            <option value="">— Elegir —</option>
            {roster.map((uid) => {
              const taken = usedIds.has(uid) && slotValues[slot] !== uid;
              return (
                <option key={uid} value={uid} disabled={taken}>
                  {userNames[uid] ?? "?"}{taken ? " (asignado)" : ""}
                </option>
              );
            })}
          </select>
        ))}
      </div>
    </div>
  );
}
