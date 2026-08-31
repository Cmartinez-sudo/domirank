"use client";

/**
 * Hook client-side para user preferences.
 * Fetch on mount; si falla o no hay fila, devuelve defaults seguros.
 * Acepta `initialPreferences` para evitar round-trip si el server component
 * ya los pasó como prop.
 *
 * US-05 — skip modality prompt
 */

import { useCallback, useEffect, useState } from "react";
import { getUserPreferences } from "@/lib/user-preferences-actions";
import { updateUserPreferences } from "@/lib/user-preferences-actions";
import type { UserPreferences, UserPreferencesInput } from "@/types/user-preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  user_id: "",
  default_match_modality: null,
  default_count_rule: null,
  default_set_size: null,
  default_target_points: null,
  default_capicua_bonus: null,
  skip_modality_prompt: false,
  notification_settings: {},
  theme: "dark",
  created_at: "",
  updated_at: "",
};

export function useUserPreferences(initialPreferences?: UserPreferences | null): {
  preferences: UserPreferences | null;
  loading: boolean;
  update: (input: UserPreferencesInput) => Promise<void>;
} {
  const [preferences, setPreferences] = useState<UserPreferences | null>(
    initialPreferences ?? null,
  );
  const [loading, setLoading] = useState(initialPreferences === undefined);

  useEffect(() => {
    // Si ya tenemos datos iniciales del server, no hacer fetch redundante
    if (initialPreferences !== undefined) return;

    let cancelled = false;

    async function fetchPreferences() {
      try {
        const data = await getUserPreferences();
        if (!cancelled) {
          setPreferences(data ?? { ...DEFAULT_PREFERENCES });
        }
      } catch (err) {
        console.warn("[useUserPreferences] fetch failed, using defaults:", err);
        if (!cancelled) {
          setPreferences({ ...DEFAULT_PREFERENCES });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPreferences();
    return () => {
      cancelled = true;
    };
  }, [initialPreferences]);

  const update = useCallback(async (input: UserPreferencesInput) => {
    const result = await updateUserPreferences(input);
    if (result.ok && result.data) {
      setPreferences(result.data);
    } else if (!result.ok) {
      console.warn("[useUserPreferences] update failed:", result.error);
    }
  }, []);

  return { preferences, loading, update };
}
