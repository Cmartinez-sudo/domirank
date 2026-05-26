"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";

type InscriptionMode = "pre_formed" | "individual_manual";

const OPTIONS: Array<{
  value: InscriptionMode;
  icon: React.ReactNode;
  label: string;
  desc: string;
}> = [
  {
    value: "pre_formed",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    label: "Parejas pre-formadas",
    desc: "Agrega parejas completas, o un jugador que después invita a su partner desde sus amigos.",
  },
  {
    value: "individual_manual",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
    label: "Individual + tú armas las parejas",
    desc: "Agrega jugadores uno por uno y asigna las parejas manualmente antes de iniciar.",
  },
];

export function Step6Form({ userId }: { userId: string }) {
  const router = useRouter();
  const { draft, setField } = useTournamentDraft(userId);
  const [mode, setMode] = useState<InscriptionMode>(
    (draft.inscription_mode as InscriptionMode) ?? "pre_formed",
  );

  function handleContinue() {
    setField({ inscription_mode: mode, currentStep: 7 });
    router.push("/tournaments/new/step-7");
  }

  return (
    <WizardStepLayout
      currentStep={6}
      primaryAction={{ label: "Continuar", onClick: handleContinue }}
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-8">
        <h1 className="text-2xl font-bold mb-2">¿Cómo se inscriben los jugadores?</h1>
        <p className="text-text-mute mb-8">
          Define si los jugadores se organizan en parejas antes de empezar o si lo haces tú después.
        </p>

        <div className="space-y-3">
          {OPTIONS.map((opt) => {
            const selected = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
                  selected
                    ? "bg-primary/10 border-primary/50 shadow-sm"
                    : "bg-surface-2 border-border hover:border-border-strong hover:bg-surface-3"
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${selected ? "text-primary" : "text-text-mute"}`}>
                  {opt.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold ${selected ? "text-primary" : "text-text"}`}>
                    {opt.label}
                  </div>
                  <div className="text-text-mute text-sm mt-0.5">{opt.desc}</div>
                </div>
                {selected && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    strokeLinejoin="round" className="text-primary shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </WizardStepLayout>
  );
}
