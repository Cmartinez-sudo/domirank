"use client";

/**
 * Sección "Preferencias de partida" dentro de /settings.
 * Gestiona (Layout 2 post-refactor):
 *  - Toggle "Preguntar configuración de partida al iniciar" (skip_modality_prompt)
 *  - Dropdown "Partida por defecto" (default_count_rule + 3 selectores derivados),
 *    visible solo si toggle OFF.
 *
 * Save on change: cada interacción llama update() de useUserPreferences.
 */

import { useEffect, useRef, useState } from "react";
import {
  PRESETS,
  PRESET_ORDER,
  matchPreset,
  type PresetId,
} from "@/lib/modalidades";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useToast } from "@/components/Toast";
import type { UserPreferences } from "@/types/user-preferences";

type Props = {
  initialPreferences?: UserPreferences | null;
};

/**
 * Deriva el preset actual del usuario a partir de sus 4 defaults.
 * Devuelve null si no puede reconstruirse un preset nombrado (estado "Personalizado").
 */
function currentPresetId(prefs: UserPreferences | null): PresetId | null {
  if (!prefs) return null;
  const p = matchPreset({
    count_rule: prefs.default_count_rule,
    set_size: prefs.default_set_size,
    target_points: prefs.default_target_points,
    capicua_bonus: prefs.default_capicua_bonus,
  });
  return p ? p.id : null;
}

export function ModalityPreferencesSection({ initialPreferences }: Props) {
  const { preferences, loading, update } = useUserPreferences(initialPreferences);
  const toast = useToast();
  const dropdownRef = useRef<HTMLSelectElement>(null);
  const [firstTimeOff, setFirstTimeOff] = useState(true);
  const [saving, setSaving] = useState(false);

  const skip = preferences?.skip_modality_prompt ?? false;
  const selectedPreset = currentPresetId(preferences ?? null);

  const toggleOn = !skip;

  useEffect(() => {
    if (!skip) setFirstTimeOff(true);
  }, [skip]);

  async function handleToggle() {
    const newSkip = !skip;
    setSaving(true);
    try {
      await update({ skip_modality_prompt: newSkip });
      toast.success("Preferencias guardadas");
      if (newSkip && firstTimeOff) {
        setFirstTimeOff(false);
        requestAnimationFrame(() => {
          dropdownRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          dropdownRef.current?.focus();
        });
      }
    } catch {
      toast.error("Error al guardar preferencias");
    } finally {
      setSaving(false);
    }
  }

  async function handlePresetChange(id: PresetId) {
    const p = PRESETS[id];
    setSaving(true);
    try {
      await update({
        default_count_rule: p.countRule,
        default_set_size: p.set,
        default_target_points: p.target,
        default_capicua_bonus: p.capicua,
      });
      toast.success("Preferencias guardadas");
    } catch {
      toast.error("Error al guardar preferencias");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="card space-y-1" aria-busy="true">
        <h2 className="font-semibold text-sm mb-3">Preferencias de partida</h2>
        <div className="h-10 rounded-md bg-surface-3/40 animate-pulse" />
      </section>
    );
  }

  return (
    <section className="card space-y-4">
      <h2 className="font-semibold text-sm">Preferencias de partida</h2>

      {/* Toggle row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium">Preguntar configuración de partida al iniciar</div>
          <div className="text-xs text-text-mute mt-0.5">
            {toggleOn
              ? "Activo. Se elige regla y ajustes al crear cada partida."
              : "Inactivo. Las partidas usan tu configuración por defecto."}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={toggleOn}
          aria-label={toggleOn ? "Desactivar pregunta de configuración" : "Activar pregunta de configuración"}
          disabled={saving}
          onClick={handleToggle}
          data-testid="modality-prompt-toggle"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 ${
            toggleOn ? "bg-primary" : "bg-surface-3"
          }`}
        >
          <span className="sr-only">
            {toggleOn ? "Preguntar configuración: activado" : "Preguntar configuración: desactivado"}
          </span>
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              toggleOn ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Preset picker — visible cuando toggle OFF (skip=true) */}
      {skip && (
        <>
          <hr className="border-border" />
          <div>
            <label htmlFor="default-preset-select" className="label mb-1 block">
              Partida por defecto
            </label>
            <select
              id="default-preset-select"
              ref={dropdownRef}
              className="input"
              value={selectedPreset ?? ""}
              disabled={saving}
              data-testid="default-modality-select"
              onChange={(e) => {
                if (e.target.value) handlePresetChange(e.target.value as PresetId);
              }}
            >
              {!selectedPreset && (
                <option value="" disabled>
                  Elegir configuración...
                </option>
              )}
              {PRESET_ORDER.map((id) => {
                const p = PRESETS[id];
                return (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.target} pts
                  </option>
                );
              })}
            </select>
            {!selectedPreset && (
              <p className="text-xs text-text-mute mt-1" role="alert">
                Elige una configuración para activar el guardado automático.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
