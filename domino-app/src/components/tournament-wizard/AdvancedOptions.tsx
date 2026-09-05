"use client";

import { useState } from "react";
import type { Visibility } from "@/hooks/useTournamentDraft";

type Props = {
  /** Mesas físicas. */
  numBoards: number;
  onNumBoardsChange: (n: number) => void;
  /** Mensaje de error inline para numBoards (cross-field con player_count). */
  numBoardsError?: string;
  /** Texto de helper para "Con N jugadores y X mesas...". */
  numBoardsHelper?: string;

  visibility: Visibility;
  onVisibilityChange: (v: Visibility) => void;

  requiresAttestation: boolean;
  onRequiresAttestationChange: (v: boolean) => void;

  rated: boolean;
  onRatedChange: (v: boolean) => void;
};

/**
 * Sección colapsable de opciones avanzadas.
 * Spec F1.4 §Step 1.5.
 *
 * Por default colapsada. Al expandir muestra:
 *  - Mesas físicas (stepper 1..10) → escribe a `num_boards`
 *  - Visibilidad (radios privada / por código)
 *  - Requiere confirmación (toggle) → escribe a `requires_attestation`
 *  - Afecta rating Elo (toggle) → escribe a `rated`
 *
 * El campo "Tiempo por ronda" antes vivía aquí; en Fase B se movió a
 * `GameConfigSection` (visible siempre, no más colapsado).
 */
export function AdvancedOptions({
  numBoards,
  onNumBoardsChange,
  numBoardsError,
  numBoardsHelper,
  visibility,
  onVisibilityChange,
  requiresAttestation,
  onRequiresAttestationChange,
  rated,
  onRatedChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-surface-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="advanced-options-content"
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-surface-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset"
      >
        <span className="font-semibold text-sm">Opciones avanzadas</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-mute transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div
          id="advanced-options-content"
          className="px-4 pb-4 pt-2 space-y-5 border-t border-border/60"
        >
          {/* Mesas físicas */}
          <div>
            <label className="label block mb-2" id="num-boards-label">
              Mesas físicas
            </label>
            <div
              className={`flex items-stretch rounded-xl border overflow-hidden ${
                numBoardsError ? "border-danger/50 bg-danger/5" : "border-border bg-surface"
              }`}
              role="group"
              aria-labelledby="num-boards-label"
            >
              <button
                type="button"
                onClick={() => onNumBoardsChange(Math.max(1, numBoards - 1))}
                disabled={numBoards <= 1}
                aria-label="Disminuir mesas"
                className="flex-1 py-3 font-bold text-lg hover:bg-surface-3 active:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                −
              </button>
              <div className="flex-1 flex items-center justify-center text-xl font-bold tabular-nums">
                {numBoards}
              </div>
              <button
                type="button"
                onClick={() => onNumBoardsChange(Math.min(10, numBoards + 1))}
                disabled={numBoards >= 10}
                aria-label="Aumentar mesas"
                className="flex-1 py-3 font-bold text-lg hover:bg-surface-3 active:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                +
              </button>
            </div>
            {numBoardsError ? (
              <p
                className="mt-1.5 text-danger text-xs"
                role="alert"
                aria-live="polite"
              >
                {numBoardsError}
              </p>
            ) : (
              numBoardsHelper && (
                <p className="mt-1.5 text-text-mute text-xs">{numBoardsHelper}</p>
              )
            )}
          </div>

          {/* Visibilidad */}
          <div>
            <label className="label block mb-2">Visibilidad</label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 bg-surface border border-border rounded-xl cursor-pointer hover:border-border-strong transition-colors">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={visibility === "private"}
                  onChange={() => onVisibilityChange("private")}
                  className="mt-0.5 accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">Privada</div>
                  <div className="text-text-mute text-xs mt-0.5">
                    Solo participantes invitados ven el torneo.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 bg-surface border border-border rounded-xl cursor-pointer hover:border-border-strong transition-colors">
                <input
                  type="radio"
                  name="visibility"
                  value="code"
                  checked={visibility === "code"}
                  onChange={() => onVisibilityChange("code")}
                  className="mt-0.5 accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">Por código</div>
                  <div className="text-text-mute text-xs mt-0.5">
                    Se genera un código de 6 dígitos para que cualquiera con el código se una.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Requires attestation */}
          <ToggleRow
            label="Requiere confirmación de jugadores"
            helper="Activado, las partidas requieren 3 de 4 jugadores firmando antes de avanzar."
            checked={requiresAttestation}
            onChange={onRequiresAttestationChange}
          />

          {/* Rated */}
          <ToggleRow
            label="Afecta el rating Elo global"
            helper={
              rated
                ? "Las partidas modifican el ranking de los participantes."
                : "Torneo amistoso: las partidas no afectan el ranking."
            }
            checked={rated}
            onChange={onRatedChange}
          />
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-text-mute text-xs mt-0.5">{helper}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
          checked ? "bg-primary" : "bg-slate-300 dark:bg-surface-3"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
