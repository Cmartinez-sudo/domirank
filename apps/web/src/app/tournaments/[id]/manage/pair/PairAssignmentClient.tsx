"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { setTournamentPairs } from "@/lib/tournament-pairs-actions";

type MiniUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

type ExistingPair = { id: number | string; user_a_id: string; user_b_id: string };

type Tournament = {
  id: string;
  name: string;
  status: string;
  max_players: number;
};

type Props = {
  tournament: Tournament;
  players: MiniUser[];
  existingPairs: ExistingPair[];
};

type FormedPair = { user_a: MiniUser; user_b: MiniUser };

export function PairAssignmentClient({ tournament, players, existingPairs }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Inicializar desde parejas existentes
  const initPairs: FormedPair[] = existingPairs
    .map((p) => {
      const a = players.find((u) => u.id === p.user_a_id);
      const b = players.find((u) => u.id === p.user_b_id);
      if (!a || !b) return null;
      return { user_a: a, user_b: b };
    })
    .filter((p): p is FormedPair => p !== null);

  const [formed, setFormed] = useState<FormedPair[]>(initPairs);
  const [selected, setSelected] = useState<MiniUser | null>(null);

  const pairedIds = new Set(formed.flatMap(({ user_a, user_b }) => [user_a.id, user_b.id]));
  const unpaired = players.filter((p) => !pairedIds.has(p.id));
  const allPaired = unpaired.length === 0 && players.length > 0 && players.length % 2 === 0;

  function handleTapUnpaired(player: MiniUser) {
    if (selected === null) {
      setSelected(player);
    } else if (selected.id === player.id) {
      // Deseleccionar
      setSelected(null);
    } else {
      // Formar pareja
      setFormed([...formed, { user_a: selected, user_b: player }]);
      setSelected(null);
    }
  }

  function handleUndoPair(index: number) {
    setFormed(formed.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setErr(null);
    startTransition(async () => {
      const pairs = formed.map(({ user_a, user_b }) => ({ user_a: user_a.id, user_b: user_b.id }));
      const r = await setTournamentPairs(tournament.id, pairs);
      if (!r.ok) setErr(r.error);
      else router.push(`/tournaments/${tournament.id}/manage`);
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/tournaments/${tournament.id}/manage`}
          aria-label="Volver a gestión del torneo"
          className="text-text-mute hover:text-text transition-colors -m-1 p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Asignar parejas</h1>
          <p className="text-text-mute text-sm">{tournament.name}</p>
        </div>
      </div>

      {err && (
        <div
          className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm"
          role="alert"
          aria-live="assertive"
        >
          {err}
        </div>
      )}

      {/* Instrucción */}
      <div className="card">
        <p className="text-text-dim text-sm">
          Toca dos jugadores para formarlos como pareja. Toca una pareja ya formada para deshacerla.
        </p>
      </div>

      {/* Jugadores sin pareja */}
      {unpaired.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-mute uppercase tracking-wider mb-3">
            Sin pareja ({unpaired.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {unpaired.map((p) => {
              const isSelected = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleTapUnpaired(p)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-primary/20 border-primary text-primary shadow-sm"
                      : "bg-surface-2 border-border hover:border-border-strong"
                  }`}
                >
                  <Avatar player={p} size={24} />
                  <span className="text-sm font-medium">{p.display_name ?? p.username}</span>
                </button>
              );
            })}
          </div>
          {selected && (
            <p className="text-primary text-sm mt-3 font-medium">
              Seleccionaste a {selected.display_name ?? selected.username} — ahora toca su partner.
            </p>
          )}
        </section>
      )}

      {/* Parejas formadas */}
      {formed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-mute uppercase tracking-wider mb-3">
            Parejas formadas ({formed.length})
          </h2>
          <div className="space-y-2">
            {formed.map(({ user_a, user_b }, i) => (
              <button
                key={`${user_a.id}-${user_b.id}`}
                type="button"
                onClick={() => handleUndoPair(i)}
                className="w-full flex items-center gap-3 p-3 bg-surface-2 border border-border rounded-xl hover:border-danger/50 hover:bg-danger/5 transition-all text-left group"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Avatar player={user_a} size={28} />
                  <span className="text-sm font-medium truncate">{user_a.display_name ?? user_a.username}</span>
                  <span className="text-text-mute text-sm">&amp;</span>
                  <Avatar player={user_b} size={28} />
                  <span className="text-sm font-medium truncate">{user_b.display_name ?? user_b.username}</span>
                </div>
                <span className="text-text-mute group-hover:text-danger text-xs shrink-0 transition-colors">
                  deshacer
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Botón guardar */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!allPaired || isPending}
        aria-busy={isPending}
        className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            Guardando…
          </span>
        ) : allPaired ? "Guardar parejas →" : `Faltan ${unpaired.length} jugadores sin pareja`}
      </button>
    </div>
  );
}
