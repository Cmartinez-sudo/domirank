"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepHeader } from "@/components/tournament-wizard/StepHeader";
import { StepFooter } from "@/components/tournament-wizard/StepFooter";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";
import type { ModalityCode } from "@/lib/modalidades";

type ModalityOption = {
  value: ModalityCode;
  flag: string;
  label: string;
  desc: string;
  goal: number;
  capicua: number;
};

const MODALITY_OPTIONS: ModalityOption[] = [
  { value: "ven", flag: "🇻🇪", label: "Venezolano", desc: "Doble-seis · meta 100 · capicúa +30", goal: 100, capicua: 30 },
  { value: "dom", flag: "🇩🇴", label: "Dominicano", desc: "Doble-seis · meta 200 · capicúa +30", goal: 200, capicua: 30 },
  { value: "cub", flag: "🇨🇺", label: "Cubano",     desc: "Doble-nueve · meta 200 · capicúa +50", goal: 200, capicua: 50 },
  { value: "pri", flag: "🇵🇷", label: "Puertorriqueño", desc: "Doble-seis · meta 200 · capicúa +50", goal: 200, capicua: 50 },
  { value: "custom", flag: "⚙", label: "Personalizado", desc: "Define la meta y el bonus de capicúa", goal: 100, capicua: 30 },
];

export function Step4Form({ userId }: { userId: string }) {
  const router = useRouter();
  const { draft, setField } = useTournamentDraft(userId);
  const [modality, setModality] = useState<ModalityCode>(
    (draft.modality as ModalityCode) ?? "ven",
  );
  const [customGoal, setCustomGoal] = useState<number>(draft.custom_goal ?? 100);
  const [customCapicua, setCustomCapicua] = useState<number>(draft.custom_capicua ?? 30);

  const isCustomValid =
    modality !== "custom" ||
    (customGoal >= 50 && customGoal <= 500 && customCapicua >= 10 && customCapicua <= 100);

  function handleContinue() {
    if (!isCustomValid) return;
    setField({
      modality,
      custom_goal: modality === "custom" ? customGoal : undefined,
      custom_capicua: modality === "custom" ? customCapicua : undefined,
      currentStep: 5,
    });
    router.push("/tournaments/new/step-5");
  }

  return (
    <div className="flex flex-col min-h-dvh">
      <StepHeader currentStep={4} />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-8 pb-32">
        <h1 className="text-2xl font-bold mb-2">¿Qué modalidad se juega?</h1>
        <p className="text-text-mute mb-8">
          Cada modalidad define la meta de puntos y el bonus de capicúa.
        </p>

        <div className="space-y-2">
          {MODALITY_OPTIONS.map((opt) => {
            const selected = modality === opt.value;
            return (
              <div key={opt.value}>
                <button
                  type="button"
                  onClick={() => setModality(opt.value)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                    selected
                      ? "bg-primary/10 border-primary/50"
                      : "bg-surface-2 border-border hover:border-border-strong hover:bg-surface-3"
                  }`}
                >
                  <span className="text-2xl shrink-0">{opt.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold ${selected ? "text-primary" : "text-text"}`}>
                      {opt.label}
                    </div>
                    <div className="text-text-mute text-xs mt-0.5">{opt.desc}</div>
                  </div>
                  {selected && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                      strokeLinejoin="round" className="text-primary shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Inline custom expansion */}
                {selected && opt.value === "custom" && (
                  <div className="mt-2 p-4 bg-surface-2 border border-border rounded-xl space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Meta de puntos</label>
                        <input
                          type="number"
                          min={50}
                          max={500}
                          step={10}
                          className="input"
                          value={customGoal}
                          onChange={(e) => setCustomGoal(parseInt(e.target.value) || 100)}
                        />
                        <p className="text-text-mute text-xs mt-1">50 - 500</p>
                      </div>
                      <div>
                        <label className="label">Bonus capicúa</label>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          step={5}
                          className="input"
                          value={customCapicua}
                          onChange={(e) => setCustomCapicua(parseInt(e.target.value) || 30)}
                        />
                        <p className="text-text-mute text-xs mt-1">10 - 100</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <StepFooter onContinue={handleContinue} disabled={!isCustomValid} />
    </div>
  );
}
