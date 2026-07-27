"use client";

import { useState } from "react";
import type { Format, Modality } from "@/hooks/useTournamentDraft";

const TIME_PRESETS: Array<{ value: number | null; label: string }> = [
  { value: null, label: "Sin límite" },
  { value: 15, label: "15min" },
  { value: 30, label: "30min" },
  { value: 45, label: "45min" },
  { value: 60, label: "60min" },
];

const POINT_PRESETS = [50, 100, 150, 200, 300];

const MIN_ROUNDS = 2;
const MAX_ROUNDS = 12;
const DEFAULT_ROUNDS = 5;

const MIN_POINTS = 50;
const MAX_POINTS = 500;

const MODALITY_POINTS: Record<Modality, number> = {
  ven: 100,
  dom: 200,
  cub: 200,
  pri: 200,
  custom: 100,
};

/** Default sugerido de puntos según la modalidad seleccionada. */
export function defaultPointsForModality(modality: Modality): number {
  return MODALITY_POINTS[modality] ?? 100;
}

type Props = {
  format: Format | undefined;
  modality: Modality;
  /** Cantidad de jugadores — usado en helper text de rondas. */
  playerCount: number;

  roundsCount: number;
  onRoundsCountChange: (n: number) => void;

  timeLimitMinutes: number | null;
  onTimeLimitMinutesChange: (n: number | null) => void;

  pointsToWin: number;
  onPointsToWinChange: (n: number) => void;
};

/**
 * Sección "Configuración de juego" del Step 1 (Fase B).
 * Contiene las 3 configs estilo Club Pro:
 *  - Rondas (solo si format='swiss')
 *  - Tiempo por ronda
 *  - Puntos a ganar
 *
 * Se ubica entre la modalidad y las Opciones avanzadas.
 */
export function GameConfigSection({
  format,
  modality,
  playerCount,
  roundsCount,
  onRoundsCountChange,
  timeLimitMinutes,
  onTimeLimitMinutesChange,
  pointsToWin,
  onPointsToWinChange,
}: Props) {
  const showRounds = format === "swiss" || format === "round_robin_individual";

  // Solo aplica al Suizo — RR Individual permite repetir el ciclo libremente.
  const maxUniqueRounds = Math.max(1, Math.floor(playerCount / 2) - 1);
  const roundsExceedUnique =
    format === "swiss" && roundsCount > maxUniqueRounds;

  // Estado local para "Otro" (input numérico libre de puntos).
  const isPresetPoints = POINT_PRESETS.includes(pointsToWin);
  const [showCustomInput, setShowCustomInput] = useState(!isPresetPoints);
  const [customInputValue, setCustomInputValue] = useState<string>(
    isPresetPoints ? "" : String(pointsToWin),
  );

  function pickPreset(p: number) {
    setShowCustomInput(false);
    setCustomInputValue("");
    onPointsToWinChange(p);
  }

  function pickOther() {
    setShowCustomInput(true);
    if (!customInputValue) setCustomInputValue(String(pointsToWin));
  }

  function commitCustom(raw: string) {
    setCustomInputValue(raw);
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) {
      const clamped = Math.min(MAX_POINTS, Math.max(MIN_POINTS, n));
      onPointsToWinChange(clamped);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-4 space-y-5">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-sm">Configuración de juego</h3>
        <span className="text-text-mute text-xs">
          {modality === "custom" ? "Custom" : `Modalidad ${modality.toUpperCase()}`}
        </span>
      </div>

      {/* Rondas — solo Suizo */}
      {showRounds && (
        <div>
          <label className="label block mb-2" id="rounds-count-label">
            Rondas de juego
          </label>
          <div
            className="flex items-stretch rounded-xl border border-border bg-surface overflow-hidden"
            role="group"
            aria-labelledby="rounds-count-label"
          >
            <button
              type="button"
              onClick={() =>
                onRoundsCountChange(Math.max(MIN_ROUNDS, roundsCount - 1))
              }
              disabled={roundsCount <= MIN_ROUNDS}
              aria-label="Disminuir rondas"
              className="flex-1 py-3 font-bold text-lg hover:bg-surface-3 active:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              −
            </button>
            <div className="flex-1 flex items-center justify-center text-xl font-bold tabular-nums">
              {roundsCount}
            </div>
            <button
              type="button"
              onClick={() =>
                onRoundsCountChange(Math.min(MAX_ROUNDS, roundsCount + 1))
              }
              disabled={roundsCount >= MAX_ROUNDS}
              aria-label="Aumentar rondas"
              className="flex-1 py-3 font-bold text-lg hover:bg-surface-3 active:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>
          <p className="mt-1.5 text-text-mute text-xs">
            {roundsExceedUnique
              ? `Con ${Math.floor(playerCount / 2)} parejas las primeras ${maxUniqueRounds} rondas son únicas; a partir de la ${maxUniqueRounds + 1} puede haber repetición de enfrentamientos.`
              : `Con ${Math.floor(playerCount / 2)} parejas hay hasta ${maxUniqueRounds} ronda${maxUniqueRounds === 1 ? "" : "s"} sin repetición.`}
          </p>
        </div>
      )}

      {/* Tiempo por ronda */}
      <div>
        <label className="label block mb-2">Tiempo por ronda</label>
        <div className="grid grid-cols-5 gap-1.5">
          {TIME_PRESETS.map((p) => {
            const selected = timeLimitMinutes === p.value;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onTimeLimitMinutesChange(p.value)}
                className={`py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                  selected
                    ? "bg-primary/10 border-primary/50 text-primary"
                    : "bg-surface border-border text-text-mute hover:border-border-strong"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Puntos a ganar */}
      <div>
        <label className="label block mb-2">Puntos a ganar</label>
        <div className="flex gap-1.5 flex-wrap">
          {POINT_PRESETS.map((p) => {
            const selected = !showCustomInput && pointsToWin === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => pickPreset(p)}
                className={`py-2.5 px-3.5 rounded-lg border text-xs font-semibold tabular-nums transition-all ${
                  selected
                    ? "bg-primary/10 border-primary/50 text-primary"
                    : "bg-surface border-border text-text-mute hover:border-border-strong"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            type="button"
            onClick={pickOther}
            className={`py-2.5 px-3.5 rounded-lg border text-xs font-semibold transition-all ${
              showCustomInput
                ? "bg-primary/10 border-primary/50 text-primary"
                : "bg-surface border-border text-text-mute hover:border-border-strong"
            }`}
          >
            Otro
          </button>
        </div>
        {showCustomInput && (
          <input
            type="number"
            inputMode="numeric"
            min={MIN_POINTS}
            max={MAX_POINTS}
            value={customInputValue}
            onChange={(e) => commitCustom(e.target.value)}
            placeholder={`${MIN_POINTS}–${MAX_POINTS}`}
            className="input text-base mt-2"
            aria-label="Puntos a ganar personalizados"
          />
        )}
        <p className="mt-1.5 text-text-mute text-xs">
          Default sugerido para {modality.toUpperCase()}:{" "}
          {defaultPointsForModality(modality)} pts. Editable.
        </p>
      </div>
    </div>
  );
}

export { DEFAULT_ROUNDS, MIN_POINTS, MAX_POINTS };
