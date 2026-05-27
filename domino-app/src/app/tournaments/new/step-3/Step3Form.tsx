"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";

type Format = "single_elim" | "round_robin" | "swiss" | "polla";

const OPTIONS: Array<{
  value: Format;
  icon: React.ReactNode;
  label: string;
  desc: string;
  detail: string;
}> = [
  {
    value: "single_elim",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
    label: "Eliminación directa",
    desc: "Bracket clásico. Pierdes una vez y quedas fuera.",
    detail: "4-64 jugadores · Rápido y emocionante",
  },
  {
    value: "round_robin",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
    label: "Todos contra todos",
    desc: "Cada pareja juega contra todas las demás exactamente una vez.",
    detail: "4-24 jugadores · Máxima justicia",
  },
  {
    value: "swiss",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    label: "Sistema suizo",
    desc: "Cada ronda enfrenta a equipos con score similar. Sin eliminación.",
    detail: "8-64+ jugadores · Ideal para grupos grandes",
  },
  {
    value: "polla",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    label: "Polla",
    desc: "Liga continua entre amigos. Pairings manuales, sin fecha de fin.",
    detail: "4-64 jugadores · Ideal para grupos de amigos",
  },
];

export function Step3Form({ userId }: { userId: string }) {
  const router = useRouter();
  const { draft, setField } = useTournamentDraft(userId);
  const [format, setFormat] = useState<Format>(
    (draft.format as Format | undefined) ?? "swiss",
  );

  function handleContinue() {
    // Resetear max_players si cambió el formato
    const prevFormat = draft.format;
    const updates: Parameters<typeof setField>[0] = {
      format,
      currentStep: 4,
    };
    if (prevFormat !== format) {
      updates.max_players = undefined;
    }
    setField(updates);
    router.push("/tournaments/new/step-4");
  }

  return (
    <WizardStepLayout
      currentStep={3}
      primaryAction={{ label: "Continuar", onClick: handleContinue }}
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-8">
        <h1 className="text-2xl font-bold mb-2">¿Qué formato usamos?</h1>
        <p className="text-text-mute mb-8">
          Define cómo se estructura la competencia.
        </p>

        <div className="space-y-3">
          {OPTIONS.map((opt) => {
            const selected = format === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormat(opt.value)}
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
                  <div className={`font-semibold ${selected ? "text-primary" : "text-text"} flex items-center gap-1 flex-wrap`}>
                    {opt.label}
                    {opt.value === "polla" && (
                      <span className="badge bg-primary/15 text-primary text-[10px] ml-2">🇻🇪 Popular en Venezuela</span>
                    )}
                  </div>
                  <div className="text-text-mute text-sm mt-0.5">{opt.desc}</div>
                  <div className="text-text-mute text-xs mt-1 font-medium">{opt.detail}</div>
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
