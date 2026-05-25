"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/tournament-wizard/StepHeader";
import { StepFooter } from "@/components/tournament-wizard/StepFooter";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";

type TimeMode = "timed" | "goal";

const TIME_PRESETS = [15, 30, 45, 60];
const BOARD_PRESETS = [1, 2, 4, 8];

export function Step8Form({ userId }: { userId: string }) {
  const router = useRouter();
  const { draft, setField } = useTournamentDraft(userId);

  const initialMode: TimeMode = draft.time_limit_minutes != null ? "timed" : "goal";
  const [mode, setMode] = useState<TimeMode>(initialMode);
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(
    draft.time_limit_minutes ?? 30,
  );
  const [customMinutes, setCustomMinutes] = useState<number>(
    draft.time_limit_minutes && !TIME_PRESETS.includes(draft.time_limit_minutes)
      ? draft.time_limit_minutes
      : 45,
  );
  const [useCustom, setUseCustom] = useState(
    draft.time_limit_minutes != null && !TIME_PRESETS.includes(draft.time_limit_minutes),
  );

  // num_boards: draft.num_boards ?? 1
  const [numBoards, setNumBoards] = useState<number>(draft.num_boards ?? 1);

  const isValid =
    mode === "goal" ||
    (mode === "timed" &&
      ((!useCustom && selectedMinutes != null) ||
        (useCustom && customMinutes >= 5 && customMinutes <= 180)));

  function handleContinue() {
    if (!isValid) return;
    const minutes =
      mode === "goal"
        ? null
        : useCustom
        ? customMinutes
        : (selectedMinutes as number);

    setField({ time_limit_minutes: minutes, num_boards: numBoards, currentStep: 9 });
    router.push("/tournaments/new/step-9");
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <StepHeader currentStep={8} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-8 pb-32">
        <h1 className="text-2xl font-bold mb-2">¿Cómo se terminan las partidas?</h1>
        <p className="text-text-mute mb-8">
          Puedes jugar con cronómetro o hasta que una pareja llegue a la meta de puntos.
        </p>

        <div className="space-y-3">
          {/* Timed */}
          <div>
            <button
              type="button"
              onClick={() => setMode("timed")}
              className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
                mode === "timed"
                  ? "bg-primary/10 border-primary/50 shadow-sm"
                  : "bg-surface-2 border-border hover:border-border-strong hover:bg-surface-3"
              }`}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                className={`mt-0.5 shrink-0 ${mode === "timed" ? "text-primary" : "text-text-mute"}`}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold ${mode === "timed" ? "text-primary" : "text-text"}`}>
                  Por tiempo <span className="text-xs font-normal text-text-mute ml-1">Recomendado</span>
                </div>
                <div className="text-text-mute text-sm mt-0.5">
                  Al expirar el tiempo, gana quien tenga más puntos.
                </div>
              </div>
              {mode === "timed" && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  strokeLinejoin="round" className="text-primary shrink-0 mt-0.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>

            {/* Inline time selector */}
            {mode === "timed" && (
              <div className="mt-2 p-4 bg-surface-2 border border-border rounded-xl">
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {TIME_PRESETS.map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => {
                        setSelectedMinutes(min);
                        setUseCustom(false);
                      }}
                      className={`py-3 rounded-xl border font-semibold transition-all ${
                        !useCustom && selectedMinutes === min
                          ? "bg-primary/10 border-primary/50 text-primary"
                          : "bg-surface border-border hover:border-border-strong"
                      }`}
                    >
                      {min}m
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUseCustom(!useCustom);
                    setSelectedMinutes(null);
                  }}
                  className={`text-sm w-full py-2 rounded-xl border transition-all ${
                    useCustom
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "border-border text-text-mute hover:border-border-strong"
                  }`}
                >
                  Otro…
                </button>
                {useCustom && (
                  <div className="mt-3">
                    <input
                      type="number"
                      min={5}
                      max={180}
                      className="input"
                      placeholder="Minutos (5-180)"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 45)}
                    />
                    <p className="text-text-mute text-xs mt-1">Entre 5 y 180 minutos.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Goal */}
          <button
            type="button"
            onClick={() => setMode("goal")}
            className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
              mode === "goal"
                ? "bg-primary/10 border-primary/50 shadow-sm"
                : "bg-surface-2 border-border hover:border-border-strong hover:bg-surface-3"
            }`}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className={`mt-0.5 shrink-0 ${mode === "goal" ? "text-primary" : "text-text-mute"}`}>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold ${mode === "goal" ? "text-primary" : "text-text"}`}>
                Hasta la meta
              </div>
              <div className="text-text-mute text-sm mt-0.5">
                La partida termina cuando una pareja alcanza los puntos de la modalidad elegida.
              </div>
            </div>
            {mode === "goal" && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                strokeLinejoin="round" className="text-primary shrink-0 mt-0.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        </div>

        {/* ── Mesas disponibles ────────────────────────────── */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-1">¿Cuántas mesas tienes?</h2>
          <p className="text-text-mute text-sm mb-4">
            Las partidas de cada ronda se distribuyen entre las mesas disponibles.
          </p>

          <div className="grid grid-cols-4 gap-2">
            {BOARD_PRESETS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumBoards(n)}
                className={`py-4 rounded-xl border font-bold text-lg transition-all ${
                  numBoards === n
                    ? "bg-primary/10 border-primary/50 text-primary"
                    : "bg-surface-2 border-border hover:border-border-strong"
                }`}
              >
                {n}
              </button>
            ))}
          </div>

          {/* Custom boards input when value not in presets */}
          {!BOARD_PRESETS.includes(numBoards) && (
            <p className="text-text-mute text-xs mt-2">
              Mesas: {numBoards}
            </p>
          )}

          {/* Inline input for custom board count */}
          <div className="mt-3 flex items-center gap-3">
            <label className="text-text-mute text-sm shrink-0">Otro número:</label>
            <input
              type="number"
              min={1}
              max={16}
              className="input w-24"
              value={numBoards}
              onChange={(e) => {
                const v = Math.max(1, Math.min(16, parseInt(e.target.value) || 1));
                setNumBoards(v);
              }}
            />
            <span className="text-text-mute text-sm">mesa{numBoards !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </main>

      <StepFooter onContinue={handleContinue} disabled={!isValid} />
    </div>
  );
}
