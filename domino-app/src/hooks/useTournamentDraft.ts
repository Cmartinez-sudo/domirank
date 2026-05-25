"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateTournamentInput } from "@/lib/tournament-schema";

// ─── Types ───────────────────────────────────────────────────

export type TournamentDraft = Partial<CreateTournamentInput> & {
  /** Paso actual del wizard (1-9) */
  currentStep?: number;
  /** Timestamp de la última vez que se modificó el draft */
  updatedAt?: number;
};

type SearchedUserMini = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

/** Draft enriquecido con datos de UI que no van al server action */
export type TournamentDraftUI = TournamentDraft & {
  /** Objetos de usuario completos para el paso 7 (solo UI, no se envían al server) */
  participants_data?: SearchedUserMini[];
  pre_formed_pairs_data?: Array<{
    user_a: SearchedUserMini;
    user_b: SearchedUserMini;
  }>;
};

// ─── Hook ────────────────────────────────────────────────────

const LS_PREFIX = "domirank:tournament-draft:";

function getKey(userId: string) {
  return `${LS_PREFIX}${userId}`;
}

/**
 * Persiste el draft del wizard de torneo en localStorage.
 * Clave: `domirank:tournament-draft:{user_id}`
 *
 * @returns
 *  - `draft`     — estado actual del draft
 *  - `setField`  — actualiza un campo puntual del draft
 *  - `saveDraft` — persiste el draft completo (usado después de setField)
 *  - `clearDraft`— borra el draft (llamar al crear con éxito)
 *  - `hasDraft`  — true si hay un draft guardado en localStorage
 */
export function useTournamentDraft(userId: string | null) {
  const [draft, setDraft] = useState<TournamentDraftUI>({});
  const [hasDraft, setHasDraft] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Cargar draft inicial desde localStorage
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(getKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as TournamentDraftUI;
        setDraft(parsed);
        setHasDraft(true);
      }
    } catch {
      // localStorage no disponible o JSON corrupto — ignorar
    }
    setInitialized(true);
  }, [userId]);

  /** Escribe en localStorage de forma síncrona. Best-effort: silencia errores. */
  const persistSync = useCallback(
    (next: TournamentDraftUI) => {
      if (!userId) return;
      try {
        localStorage.setItem(getKey(userId), JSON.stringify(next));
      } catch {
        // quota exceeded o localStorage deshabilitado — silencioso
      }
    },
    [userId],
  );

  /**
   * Actualiza uno o varios campos del draft.
   * La escritura a localStorage es SÍNCRONA dentro del setState callback
   * para evitar la race condition: si el wizard navega al siguiente paso
   * antes de que el setTimeout se dispare, el siguiente paso leería el
   * draft viejo de localStorage.
   */
  const setField = useCallback(
    (updates: Partial<TournamentDraftUI>) => {
      setDraft((prev) => {
        const next: TournamentDraftUI = {
          ...prev,
          ...updates,
          updatedAt: Date.now(),
        };
        // Flush síncrono — evita race con navegación rápida entre pasos
        persistSync(next);
        return next;
      });
      setHasDraft(true);
    },
    [persistSync],
  );

  /** Guarda el draft completo (útil al reemplazar con un objeto nuevo) */
  const saveDraft = useCallback(
    (newDraft: TournamentDraftUI) => {
      const next = { ...newDraft, updatedAt: Date.now() };
      setDraft(next);
      setHasDraft(true);
      persistSync(next);
    },
    [persistSync],
  );

  /** Borra el draft de localStorage y resetea el estado */
  const clearDraft = useCallback(() => {
    if (!userId) return;
    try {
      localStorage.removeItem(getKey(userId));
    } catch {
      // ignorar
    }
    setDraft({});
    setHasDraft(false);
  }, [userId]);

  return { draft, setField, saveDraft, clearDraft, hasDraft, initialized };
}
