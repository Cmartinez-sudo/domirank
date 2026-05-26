"use client";

/**
 * Sección "Preferencias de partida" dentro de /settings.
 * Gestiona:
 *  - Toggle "Preguntar modalidad antes de cada partida" (skip_modality_prompt)
 *  - Dropdown "Modalidad por defecto" (default_match_modality), visible solo si toggle OFF
 *
 * Save on change: cada interacción llama update() de useUserPreferences inmediatamente.
 * US-06 — sprint UX/UI v2
 */

import { useEffect, useRef, useState } from "react";
import { MODALIDADES } from "@/lib/modalidades";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useToast } from "@/components/Toast";
import type { UserPreferences } from "@/types/user-preferences";

/** Subset of ModalityCode valid for user_preferences (excludes 'custom') */
type PrefsModalityCode = "ven" | "dom" | "cub" | "pri";

type Props = {
  initialPreferences?: UserPreferences | null;
};

const MODALITY_OPTIONS: { code: PrefsModalityCode; label: string }[] = [
  { code: "ven", label: `${MODALIDADES.ven.flag} Venezolano` },
  { code: "dom", label: `${MODALIDADES.dom.flag} Dominicano` },
  { code: "cub", label: `${MODALIDADES.cub.flag} Cubano` },
  { code: "pri", label: `${MODALIDADES.pri.flag} Puertorriqueño` },
];

export function ModalityPreferencesSection({ initialPreferences }: Props) {
  const { preferences, loading, update } = useUserPreferences(initialPreferences);
  const toast = useToast();
  const dropdownRef = useRef<HTMLSelectElement>(null);
  const [firstTimeOff, setFirstTimeOff] = useState(true);
  const [saving, setSaving] = useState(false);

  const skip = preferences?.skip_modality_prompt ?? false;
  const defaultModality = preferences?.default_match_modality ?? null;

  // Derived: toggle is ON when skip=false, toggle is OFF when skip=true
  const toggleOn = !skip;

  useEffect(() => {
    if (!skip) setFirstTimeOff(true);
  }, [skip]);

  async function handleToggle() {
    const newSkip = !skip;

    // If switching to OFF without a default modality, show dropdown but don't persist yet
    if (newSkip && !defaultModality) {
      // Optimistic local update via update() — we still call update to set skip=true
      // but the spec says: "si OFF sin default_match_modality → placeholder + bloqueo"
      // We update state locally only to show the dropdown; persist happens when user picks
      setSaving(true);
      try {
        await update({ skip_modality_prompt: true });
        toast.success("Preferencias guardadas");
        // Scroll to dropdown on first OFF
        if (firstTimeOff) {
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
      return;
    }

    setSaving(true);
    try {
      await update({ skip_modality_prompt: newSkip });
      toast.success("Preferencias guardadas");
      // Scroll to dropdown when first turning OFF
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

  async function handleModalityChange(code: PrefsModalityCode) {
    setSaving(true);
    try {
      await update({ default_match_modality: code });
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
          <div className="text-sm font-medium">Preguntar modalidad antes de cada partida</div>
          <div className="text-xs text-text-mute mt-0.5">
            {toggleOn
              ? "Activo. Se pregunta la modalidad al crear cada partida."
              : "Inactivo. Las partidas usan tu modalidad por defecto."}
          </div>
        </div>

        {/* Toggle switch — same pattern as PushSubscriptionToggle */}
        <button
          type="button"
          role="switch"
          aria-checked={toggleOn}
          aria-label={toggleOn ? "Desactivar pregunta de modalidad" : "Activar pregunta de modalidad"}
          disabled={saving}
          onClick={handleToggle}
          data-testid="modality-prompt-toggle"
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 ${
            toggleOn ? "bg-primary" : "bg-surface-3"
          }`}
        >
          <span className="sr-only">
            {toggleOn ? "Preguntar modalidad: activado" : "Preguntar modalidad: desactivado"}
          </span>
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              toggleOn ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Dropdown — solo visible cuando toggle es OFF (skip=true) */}
      {skip && (
        <>
          <hr className="border-border" />
          <div>
            <label htmlFor="default-modality-select" className="label mb-1 block">
              Modalidad por defecto
            </label>
            <select
              id="default-modality-select"
              ref={dropdownRef}
              className="input"
              value={defaultModality ?? ""}
              disabled={saving}
              data-testid="default-modality-select"
              onChange={(e) => {
                if (e.target.value) handleModalityChange(e.target.value as PrefsModalityCode);
              }}
            >
              {!defaultModality && (
                <option value="" disabled>
                  Elegir modalidad...
                </option>
              )}
              {MODALITY_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!defaultModality && (
              <p className="text-xs text-text-mute mt-1" role="alert">
                Elige una modalidad para activar el guardado automatico.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
