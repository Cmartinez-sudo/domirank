"use client";

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
  /** Lista actual de jugadores seleccionados */
  selected: MiniUser[];
  /** IDs a excluir de la búsqueda (ya seleccionados u otros) */
  excludeIds?: string[];
  onAdd: (u: SearchedUser) => void;
  onRemove: (id: string) => void;
  /** Si true, el usuario no puede ser removido */
  lockedIds?: string[];
  max?: number;
  placeholder?: string;
  label?: string;
};

/**
 * Wrapper de búsqueda de jugadores para el wizard.
 * Muestra chips con los seleccionados y permite removerlos.
 */
export function PlayerSearch({
  selected,
  excludeIds = [],
  onAdd,
  onRemove,
  lockedIds = [],
  max,
  placeholder = "Busca por @usuario o nombre…",
  label,
}: Props) {
  const allExcluded = [...excludeIds, ...selected.map((s) => s.id)];
  const isAtMax = max !== undefined && selected.length >= max;

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium text-text-dim">{label}</p>}

      {/* Lista de seleccionados */}
      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((u) => {
            const locked = lockedIds.includes(u.id);
            return (
              <div
                key={u.id}
                className="flex items-center gap-3 p-2.5 bg-surface-2 rounded-xl border border-border"
              >
                <Avatar player={u} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {u.display_name ?? u.username}
                  </div>
                  <div className="text-text-mute text-xs">@{u.username}</div>
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => onRemove(u.id)}
                    aria-label={`Quitar a ${u.display_name ?? u.username}`}
                    className="text-text-mute hover:text-danger rounded-lg hover:bg-danger/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
                {locked && (
                  <span className="text-text-mute text-xs px-2">tú</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Input de búsqueda */}
      {!isAtMax && (
        <UserSearch
          excludeIds={allExcluded}
          placeholder={placeholder}
          onSelect={onAdd}
          showRating
        />
      )}

      {isAtMax && (
        <p className="text-text-mute text-sm text-center py-2">
          Llegaste al máximo de {max} jugadores.
        </p>
      )}
    </div>
  );
}
