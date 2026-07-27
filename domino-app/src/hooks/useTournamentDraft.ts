"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────

/**
 * Shape del draft del wizard nuevo (3 pasos).
 * Refleja las decisiones del usuario antes de llamar a `createTournament`.
 *
 * Notas:
 *  - `num_boards` mapea al DB column del mismo nombre. UI valida 1..10
 *    (constraint del producto), pero el DB allow 1..16.
 *  - `requires_attestation` (default true) → escribe a `tournaments.requires_attestation`.
 *  - `inscription_mode` NO está en el draft: se deriva del `format` en el
 *    momento de crear el torneo.
 *  - `participants_data` es solo UI: objetos completos de los jugadores
 *    seleccionados (para mostrar avatars/nombres sin re-fetch). No se envía
 *    al server action.
 */
export type Format =
  | "swiss"
  | "round_robin"
  | "round_robin_individual"
  | "single_elim";

export type Modality = "ven" | "dom" | "cub" | "pri" | "custom";

export type Visibility = "private" | "code";

type SearchedUserMini = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

export type TournamentDraftUI = {
  /** Nombre (3-60 chars). Si vacío, el wizard usa placeholder "Polla del {día}". */
  name?: string;
  format?: Format;
  modality?: Modality;
  /** Cantidad de jugadores objetivo (4..64). Default 4. */
  player_count?: number;
  /** IDs de participantes seleccionados (NO incluye al organizer). */
  participant_ids?: string[];
  /** Objetos completos para UI (avatars/nombres) — no se envían al server. */
  participants_data?: SearchedUserMini[];
  /** Mesas físicas (UI 1..10, DB 1..16). Default 1. */
  num_boards?: number;
  visibility?: Visibility;
  /** Si las partidas requieren 3 de 4 firmas para avanzar. Default true. */
  requires_attestation?: boolean;
  /** Si afecta el rating Elo global. Default true. */
  rated?: boolean;
  /** Minutos de tiempo límite, o null para "sin límite". */
  time_limit_minutes?: number | null;
  /** Rondas planificadas (solo aplica a format='swiss'). 2..12. */
  rounds_count?: number | null;
  /**
   * Puntos objetivo de la partida. Fase B: editable siempre, prepoblado
   * según modality. Persiste como `custom_goal` en el server action;
   * `pointsToWin` lo prioriza sobre el default de modality.
   */
  custom_goal?: number;
  custom_capicua?: number;
  /**
   * Legacy del wizard viejo. El wizard nuevo (3 pasos) no expone esto al
   * usuario — siempre false. Mantenido por compatibilidad con
   * `ContinuousLeagueConfigStep` y callers legacy.
   */
  is_open_ended?: boolean;
  /** Paso actual del wizard (1-3). */
  currentStep?: number;
  /** Timestamp de la última modificación. */
  updatedAt?: number;
};

// ─── Hook ────────────────────────────────────────────────────

// Bump de versión cuando el shape del draft cambia (refactor F1.4: 9 → 3 steps).
// Los drafts viejos quedan abandonados (no migran — el shape cambió demasiado).
const LS_PREFIX = "domirank:tournament-draft:v2:";

function getKey(userId: string) {
  return `${LS_PREFIX}${userId}`;
}

/**
 * Persiste el draft del wizard de torneo en localStorage.
 * Clave: `domirank:tournament-draft:v2:{user_id}`
 *
 * @returns
 *  - `draft`     — estado actual del draft
 *  - `setField`  — actualiza uno o varios campos del draft
 *  - `saveDraft` — persiste el draft completo (usado al reemplazar con un objeto nuevo)
 *  - `clearDraft`— borra el draft (llamar al crear con éxito)
 *  - `hasDraft`  — true si hay un draft guardado en localStorage
 *  - `initialized` — true después de leer el draft inicial de localStorage
 */
export function useTournamentDraft(userId: string | null) {
  const [draft, setDraft] = useState<TournamentDraftUI>({});
  const [hasDraft, setHasDraft] = useState(false);
  const [initialized, setInitialized] = useState(false);
  /**
   * Flag para drafts viejos con format='continuous_league' (Fase 5).
   * El caller puede leer este flag para mostrar un toast al usuario.
   * Reset del field se hace inline: el draft se reescribe sin format.
   */
  const [legacyFormatReset, setLegacyFormatReset] = useState(false);

  // Cargar draft inicial desde localStorage
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(getKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as Omit<TournamentDraftUI, "format"> & {
          format?: string;
        };
        // Post-Fase-5: si el draft viejo tiene format='continuous_league',
        // resetar el field y avisar al caller para que muestre toast.
        if (parsed.format === "continuous_league") {
          delete parsed.format;
          setLegacyFormatReset(true);
        }
        setDraft(parsed as TournamentDraftUI);
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
        persistSync(next);
        return next;
      });
      setHasDraft(true);
    },
    [persistSync],
  );

  /** Guarda el draft completo (útil al reemplazar con un objeto nuevo). */
  const saveDraft = useCallback(
    (newDraft: TournamentDraftUI) => {
      const next = { ...newDraft, updatedAt: Date.now() };
      setDraft(next);
      setHasDraft(true);
      persistSync(next);
    },
    [persistSync],
  );

  /** Borra el draft de localStorage y resetea el estado. */
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

  /** Reset del flag (el caller lo invoca después de mostrar el toast). */
  const acknowledgeLegacyReset = useCallback(() => setLegacyFormatReset(false), []);

  return {
    draft,
    setField,
    saveDraft,
    clearDraft,
    hasDraft,
    initialized,
    legacyFormatReset,
    acknowledgeLegacyReset,
  };
}
