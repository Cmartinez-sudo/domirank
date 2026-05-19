"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { searchUsers, type SearchedUser } from "@/lib/users";
import { COUNTRIES } from "@/lib/modalidades";

type Props = {
  /** Si está presente, los IDs en este set NO aparecen en los resultados (ya elegidos). */
  excludeIds?: string[];
  /** Placeholder del input. */
  placeholder?: string;
  /** Callback cuando el usuario selecciona alguien. */
  onSelect: (u: SearchedUser) => void;
  /** Mostrar lista de "ya seleccionados" arriba del input (opcional). */
  selected?: SearchedUser[];
  onRemove?: (id: string) => void;
  autoFocus?: boolean;
};

function countryFlag(code: string | null) {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code)?.flag ?? null;
}

export function UserSearch({ excludeIds, placeholder, onSelect, selected, onRemove, autoFocus }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const excludeSet = new Set(excludeIds ?? []);

  // Debounced search
  useEffect(() => {
    if (q.trim().length === 0) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const data = await searchUsers(q, { limit: 8 });
      if (!cancelled) {
        setResults(data.filter((u) => !excludeSet.has(u.id)));
        setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click outside cierra dropdown
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      {selected && selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2 bg-surface-2 border border-border rounded-full pl-1.5 pr-2 py-1">
              <Avatar player={s as any} size={22} />
              <span className="text-sm">
                {countryFlag(s.country) && <span className="mr-1">{countryFlag(s.country)}</span>}
                {s.display_name || s.username}
              </span>
              {onRemove && (
                <button
                  type="button"
                  className="text-text-mute hover:text-danger ml-1"
                  onClick={() => onRemove(s.id)}
                  aria-label="Quitar"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <input
        id={inputId}
        className="input"
        placeholder={placeholder ?? "Buscar jugador por @usuario o nombre…"}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {open && q.trim().length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-pop max-h-72 overflow-y-auto">
          {loading && <div className="p-3 text-text-mute text-sm">Buscando…</div>}
          {!loading && results.length === 0 && (
            <div className="p-3 text-text-mute text-sm">Sin resultados para “{q}”.</div>
          )}
          {!loading &&
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onSelect(u);
                  setQ("");
                  setResults([]);
                  setOpen(false);
                }}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 transition-colors"
              >
                <Avatar player={u as any} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {countryFlag(u.country) && <span className="mr-1.5">{countryFlag(u.country)}</span>}
                    {u.display_name || u.username}
                  </div>
                  <div className="text-text-mute text-xs truncate">@{u.username}</div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
