"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import {
  useTournamentDraft,
  type CountRule,
  type Format,
  type PresetIdInDraft,
  type Visibility,
} from "@/hooks/useTournamentDraft";
import {
  validateTournamentConfig,
  diaDeSemanaEs,
} from "@/lib/tournament-validation";
import { PRESETS } from "@domirank/shared/matches";
import { FormatPickerCards } from "@/components/tournament-wizard/FormatPickerCards";
import { PlayersCountStepper } from "@/components/tournament-wizard/PlayersCountStepper";
import { ModalityChips } from "@/components/tournament-wizard/ModalityChips";
import { AdvancedOptions } from "@/components/tournament-wizard/AdvancedOptions";
import {
  GameConfigSection,
  DEFAULT_ROUNDS,
  defaultPointsForPreset,
} from "@/components/tournament-wizard/GameConfigSection";

/**
 * Step 1 — Configuración combinada del torneo.
 *
 * Una sola pantalla con:
 *  - Nombre (placeholder dinámico "Polla del {día}")
 *  - Formato (4 cards 2×2)
 *  - Cantidad de jugadores (stepper)
 *  - Modalidad (chips)
 *  - Opciones avanzadas (colapsadas: mesas, visibilidad, attestation, rated, tiempo)
 *
 * Validación inline cross-field por formato + cantidad de jugadores + mesas.
 */
export function Step1Form({ userId }: { userId: string }) {
  const router = useRouter();
  const { draft, setField, legacyFormatReset, acknowledgeLegacyReset } =
    useTournamentDraft(userId);

  // Placeholder dinámico estable durante el lifetime del componente
  const placeholder = useMemo(() => `Polla del ${diaDeSemanaEs()}`, []);

  // Estado local. Se persiste a localStorage al continuar (handleContinue).
  const [name, setName] = useState(draft.name ?? "");
  const [format, setFormat] = useState<Format | undefined>(draft.format);
  const [playerCount, setPlayerCount] = useState<number>(draft.player_count ?? 4);
  const [countRule, setCountRule] = useState<CountRule>(
    draft.count_rule ?? (draft.modality === "pri" ? "mesa" : "rival"),
  );
  const [preset, setPreset] = useState<PresetIdInDraft | null>(
    draft.preset ??
      (draft.modality === "ven"
        ? "rapido"
        : draft.modality === "dom"
        ? "clasico"
        : draft.modality === "cub"
        ? "clasico" // Cuba post-retiro d9
        : draft.modality === "pri"
        ? "mesa-completa"
        : "rapido"),
  );
  const [numBoards, setNumBoards] = useState<number>(draft.num_boards ?? 1);
  const [visibility, setVisibility] = useState<Visibility>(
    draft.visibility ?? "private",
  );
  const [requiresAttestation, setRequiresAttestation] = useState<boolean>(
    draft.requires_attestation ?? true,
  );
  const [rated, setRated] = useState<boolean>(draft.rated ?? true);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | null>(
    draft.time_limit_minutes ?? null,
  );
  const [roundsCount, setRoundsCount] = useState<number>(
    draft.rounds_count ?? DEFAULT_ROUNDS,
  );
  const [pointsToWin, setPointsToWin] = useState<number>(
    draft.custom_goal ??
      (preset ? PRESETS[preset].target : defaultPointsForPreset("rapido")),
  );

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Foco en el campo nombre al abrir el step (solo si está vacío)
    if (!name) inputRef.current?.focus();
  }, [name]);

  // Validación cross-field — solo si hay un formato seleccionado
  const validation = useMemo(() => {
    if (!format) return { valid: false, errors: {} };
    return validateTournamentConfig({ format, player_count: playerCount, num_boards: numBoards });
  }, [format, playerCount, numBoards]);

  // Validación de nombre
  const trimmedName = name.trim();
  const nameValid = trimmedName.length === 0 || (trimmedName.length >= 3 && trimmedName.length <= 60);
  const nameTooShort = trimmedName.length > 0 && trimmedName.length < 3;

  // Helper text para mesas físicas
  const numBoardsHelper =
    playerCount >= 4 && format
      ? `Con ${playerCount} jugador${playerCount !== 1 ? "es" : ""} y ${numBoards} mesa${numBoards !== 1 ? "s" : ""}, se juegan ${Math.min(
          numBoards,
          Math.floor(playerCount / 4),
        )} partida${Math.min(numBoards, Math.floor(playerCount / 4)) !== 1 ? "s" : ""} paralela${
          Math.min(numBoards, Math.floor(playerCount / 4)) !== 1 ? "s" : ""
        }.`
      : undefined;

  // Botón "Continuar" deshabilitado si:
  //  - No hay formato seleccionado
  //  - Nombre inválido (longitud)
  //  - Cualquier error de validación cross-field
  const canContinue =
    !!format && nameValid && validation.valid;

  /**
   * Al elegir un preset, precarga sus 3 valores. El usuario puede editar
   * después (deselecciona preset → estado "Personalizado" implícito).
   */
  function handlePresetChange(next: PresetIdInDraft) {
    const p = PRESETS[next];
    setPreset(next);
    setCountRule(p.countRule);
    setPointsToWin(p.target);
  }

  /** Cambiar de regla deselecciona el preset actual (Pregunta 11A). */
  function handleCountRuleChange(next: CountRule) {
    if (next === countRule) return;
    setCountRule(next);
    setPreset(null);
  }

  function handlePointsToWinChange(next: number) {
    setPointsToWin(next);
    // Si el usuario ajusta manualmente, el preset se marca implícitamente como Personalizado.
    if (preset && PRESETS[preset]?.target !== next) {
      setPreset(null);
    }
  }

  function handleContinue() {
    if (!canContinue || !format) return;
    // Si name está vacío, usar el placeholder como nombre
    const finalName = trimmedName || placeholder;
    setField({
      name: finalName,
      format,
      count_rule: countRule,
      preset: preset ?? undefined,
      // Dual-write legacy modality para consumidores viejos (Step-3, etc).
      modality:
        preset === "rapido" ? "ven"
        : preset === "clasico" ? "dom"
        : preset === "doble9" ? "cub"
        : preset === "mesa-completa" ? "pri"
        : "custom",
      player_count: playerCount,
      num_boards: numBoards,
      visibility,
      requires_attestation: requiresAttestation,
      rated,
      time_limit_minutes: timeLimitMinutes,
      // rounds_count solo persiste si el formato lo usa (Suizo o RR Individual
      // donde R = cantidad de ciclos completos). En los demás formatos
      // pasamos null para que el motor decida.
      rounds_count:
        format === "swiss" || format === "round_robin_individual" ? roundsCount : null,
      // pointsToWin se mapea a `custom_goal`; el server action prioriza este
      // sobre el default de modality (lógica `pointsToWin` en tournaments.ts).
      custom_goal: pointsToWin,
      currentStep: 2,
    });
    router.push("/tournaments/new/step-2");
  }

  return (
    <WizardStepLayout
      currentStep={1}
      primaryAction={{
        label: "Continuar →",
        onClick: handleContinue,
        disabled: !canContinue,
      }}
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-6 space-y-6">
        {/* Aviso si el draft viejo tenía Liga continua (Fase 5) */}
        {legacyFormatReset && (
          <div className="p-3 rounded-xl border border-info/30 bg-info/10 text-info text-sm flex items-start justify-between gap-3">
            <span>
              El formato <strong>Liga continua</strong> ya no existe. Elegí
              otro formato para continuar con este borrador. Usá{" "}
              <a href="/groups" className="underline font-semibold">Grupos</a>{" "}
              para organizar partidas recurrentes.
            </span>
            <button
              type="button"
              onClick={acknowledgeLegacyReset}
              aria-label="Descartar aviso"
              className="text-info hover:opacity-70 transition-opacity shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Nombre */}
        <section>
          <label htmlFor="tournament-name" className="label block mb-2">
            Nombre del torneo
          </label>
          <input
            ref={inputRef}
            id="tournament-name"
            type="text"
            className="input text-base"
            placeholder={placeholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="off"
            aria-describedby="name-hint"
          />
          <div className="flex justify-between mt-1.5" id="name-hint" aria-live="polite">
            <p className={`text-xs ${nameTooShort ? "text-danger" : "text-text-mute"}`}>
              {nameTooShort ? "Mínimo 3 caracteres" : "Opcional — usaremos el placeholder si lo dejas vacío"}
            </p>
            {name.length > 0 && (
              <p className={`text-xs ${name.length > 54 ? "text-warning" : "text-text-mute"}`}>
                {name.length}/60
              </p>
            )}
          </div>
        </section>

        {/* Formato */}
        <section>
          <label className="label block mb-2">Formato</label>
          <FormatPickerCards value={format} onChange={setFormat} />
          {!format && (
            <p className="text-text-mute text-xs mt-2">
              Elige un formato para continuar.
            </p>
          )}
        </section>

        {/* Cantidad de jugadores */}
        <section>
          <PlayersCountStepper
            value={playerCount}
            onChange={setPlayerCount}
            error={validation.errors.player_count}
          />
        </section>

        {/* Modalidad de juego (Layout 2) */}
        <section>
          <label className="label block mb-2">Modalidad de juego</label>
          <ModalityChips
            countRule={countRule}
            onCountRuleChange={handleCountRuleChange}
            preset={preset}
            onPresetChange={handlePresetChange}
          />
        </section>

        {/* Configuración de juego (Fase B) */}
        <section>
          <GameConfigSection
            format={format}
            preset={preset}
            playerCount={playerCount}
            roundsCount={roundsCount}
            onRoundsCountChange={setRoundsCount}
            timeLimitMinutes={timeLimitMinutes}
            onTimeLimitMinutesChange={setTimeLimitMinutes}
            pointsToWin={pointsToWin}
            onPointsToWinChange={handlePointsToWinChange}
          />
        </section>

        {/* Opciones avanzadas (colapsadas por default) */}
        <section>
          <AdvancedOptions
            numBoards={numBoards}
            onNumBoardsChange={setNumBoards}
            numBoardsError={validation.errors.num_boards}
            numBoardsHelper={numBoardsHelper}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            requiresAttestation={requiresAttestation}
            onRequiresAttestationChange={setRequiresAttestation}
            rated={rated}
            onRatedChange={setRated}
          />
        </section>
      </div>
    </WizardStepLayout>
  );
}
