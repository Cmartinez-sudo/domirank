"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";

const PRESETS_BY_FORMAT: Record<string, number[]> = {
  single_elim: [4, 8, 16, 32, 64],
  round_robin: [8, 12, 16, 20, 24],
  swiss: [8, 12, 16, 24, 32, 48, 64],
  // Polla: roster fijo de 4-8 amigos, par (spec decisión #4).
  continuous_league: [4, 6, 8],
};

// En round_robin mostramos parejas (jugadores / 2)
const PAIRS_BY_FORMAT: Record<string, number[]> = {
  round_robin: [4, 6, 8, 10, 12],
};

export function Step5Form({ userId }: { userId: string }) {
  const router = useRouter();
  const { draft, setField } = useTournamentDraft(userId);
  const format = draft.format ?? "swiss";
  const presets = PRESETS_BY_FORMAT[format] ?? [8, 16, 32];
  const isRR = format === "round_robin";

  const [selected, setSelected] = useState<number | null>(draft.max_players ?? null);

  function handleSelect(n: number) {
    setSelected(n);
  }

  function handleContinue() {
    if (!selected) return;
    setField({ max_players: selected, currentStep: 6 });
    router.push("/tournaments/new/step-6");
  }

  return (
    <WizardStepLayout
      currentStep={5}
      primaryAction={{
        label: "Continuar",
        onClick: handleContinue,
        disabled: !selected,
      }}
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-8">
        <h1 className="text-2xl font-bold mb-2">
          {isRR ? "¿Cuántas parejas participan?" : "¿Cuántos jugadores van a jugar?"}
        </h1>
        <p className="text-text-mute mb-8">
          {isRR
            ? "En Round Robin el número de partidas es N × (N-1) / 2."
            : format === "single_elim"
            ? "Con eliminación directa el cupo debe ser potencia de 2 para un bracket limpio."
            : "El sistema suizo escala bien con grupos grandes."}
        </p>

        <div className="grid grid-cols-3 gap-3">
          {(isRR ? PAIRS_BY_FORMAT.round_robin : presets).map((n) => {
            const displayN = isRR ? n * 2 : n;
            const isSelected = selected === displayN;
            return (
              <button
                key={n}
                type="button"
                onClick={() => handleSelect(displayN)}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? "bg-primary/10 border-primary/50 shadow-sm"
                    : "bg-surface-2 border-border hover:border-border-strong hover:bg-surface-3"
                }`}
              >
                <span className={`text-3xl font-bold ${isSelected ? "text-primary" : "text-text"}`}>
                  {isRR ? n : n}
                </span>
                {isRR && (
                  <span className="text-text-mute text-xs mt-1">{n * 2} jugadores</span>
                )}
                {!isRR && (
                  <span className="text-text-mute text-xs mt-1">
                    {Math.floor(n / 2)} parejas
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </WizardStepLayout>
  );
}
