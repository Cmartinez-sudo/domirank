"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import type { SearchedUser } from "@/lib/users";

type MiniUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

type Props = {
  /** IDs ya usados en el wizard (para excluir de búsqueda) */
  excludeIds?: string[];
  onAdd: (userA: MiniUser, userB: MiniUser) => void;
  onCancel?: () => void;
};

/**
 * Selector dual para agregar una pareja completa.
 * Muestra dos slots de búsqueda en paralelo.
 * Cuando ambos están llenos, habilita el botón "Agregar pareja".
 */
export function PairDualSelector({ excludeIds = [], onAdd, onCancel }: Props) {
  const [playerA, setPlayerA] = useState<MiniUser | null>(null);
  const [playerB, setPlayerB] = useState<MiniUser | null>(null);

  const allExcluded = [
    ...excludeIds,
    ...(playerA ? [playerA.id] : []),
    ...(playerB ? [playerB.id] : []),
  ];

  function clear() {
    setPlayerA(null);
    setPlayerB(null);
  }

  function confirm() {
    if (!playerA || !playerB) return;
    onAdd(playerA, playerB);
    clear();
  }

  return (
    <div className="space-y-4">
      <p className="text-text-dim text-sm">
        Selecciona los dos integrantes de la pareja:
      </p>

      {/* Slot A */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-text-mute uppercase tracking-wider">Jugador 1</div>
        {playerA ? (
          <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-xl">
            <Avatar player={playerA} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {playerA.display_name ?? playerA.username}
              </div>
              <div className="text-text-mute text-xs">@{playerA.username}</div>
            </div>
            <button
              type="button"
              onClick={() => setPlayerA(null)}
              aria-label={`Quitar a ${playerA.display_name ?? playerA.username}`}
              className="-m-1.5 p-1.5 rounded-md text-text-mute hover:text-danger hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <UserSearch
            excludeIds={allExcluded}
            placeholder="Busca el primer jugador…"
            onSelect={(u: SearchedUser) => setPlayerA(u as MiniUser)}
          />
        )}
      </div>

      {/* Slot B */}
      <div className="space-y-1.5">
        <div className="text-xs font-semibold text-text-mute uppercase tracking-wider">Jugador 2</div>
        {playerB ? (
          <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-xl">
            <Avatar player={playerB} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {playerB.display_name ?? playerB.username}
              </div>
              <div className="text-text-mute text-xs">@{playerB.username}</div>
            </div>
            <button
              type="button"
              onClick={() => setPlayerB(null)}
              aria-label={`Quitar a ${playerB.display_name ?? playerB.username}`}
              className="-m-1.5 p-1.5 rounded-md text-text-mute hover:text-danger hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <UserSearch
            excludeIds={allExcluded}
            placeholder="Busca el segundo jugador…"
            onSelect={(u: SearchedUser) => setPlayerB(u as MiniUser)}
          />
        )}
      </div>

      {/* Acciones */}
      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost flex-1"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={confirm}
          disabled={!playerA || !playerB}
          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Agregar pareja
        </button>
      </div>
    </div>
  );
}
