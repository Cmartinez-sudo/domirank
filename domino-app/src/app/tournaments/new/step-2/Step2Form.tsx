"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";

const ICON_GLOBE = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const ICON_LOCK = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const ICON_KEY = (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="15" r="4" />
    <line x1="10.85" y1="12.15" x2="19" y2="4" />
    <line x1="18" y1="5" x2="20" y2="7" />
    <line x1="15" y1="8" x2="17" y2="10" />
  </svg>
);

type Visibility = "public" | "private" | "code";

const OPTIONS: Array<{
  value: Visibility;
  icon: React.ReactNode;
  label: string;
  desc: string;
}> = [
  {
    value: "public",
    icon: ICON_GLOBE,
    label: "Pública",
    desc: "Cualquiera puede descubrir este torneo y ser agregado por el organizador.",
  },
  {
    value: "private",
    icon: ICON_LOCK,
    label: "Privada",
    desc: "Solo los jugadores que agregues manualmente se enteran del torneo.",
  },
  {
    value: "code",
    icon: ICON_KEY,
    label: "Por código",
    desc: "El torneo es privado pero se puede unir con un código de 6 dígitos.",
  },
];

export function Step2Form({ userId }: { userId: string }) {
  const router = useRouter();
  const { draft, setField } = useTournamentDraft(userId);
  const [visibility, setVisibility] = useState<Visibility>(
    (draft.visibility as Visibility) ?? "private",
  );

  const isPolla = draft.format === "polla";

  useEffect(() => {
    if (isPolla && draft.visibility !== "private") {
      setField({ visibility: "private" });
    }
  }, [isPolla, draft.visibility, setField]);

  function handleContinue() {
    setField({ visibility, currentStep: 3 });
    router.push("/tournaments/new/step-3");
  }

  return (
    <WizardStepLayout
      currentStep={2}
      primaryAction={{ label: "Continuar", onClick: handleContinue }}
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-8">
        <h1 className="text-2xl font-bold mb-2">¿Quién puede ver el torneo?</h1>
        <p className="text-text-mute mb-8">
          Puedes cambiar esto después mientras el torneo esté abierto.
        </p>

        <div className="space-y-3">
          {OPTIONS.map((opt) => {
            const selected = visibility === opt.value;
            const disabledByPolla = isPolla && opt.value !== "private";
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => !disabledByPolla && setVisibility(opt.value)}
                disabled={disabledByPolla}
                className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
                  disabledByPolla
                    ? "opacity-40 cursor-not-allowed bg-surface-2 border-border"
                    : selected
                    ? "bg-primary/10 border-primary/50 shadow-sm"
                    : "bg-surface-2 border-border hover:border-border-strong hover:bg-surface-3"
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 ${selected && !disabledByPolla ? "text-primary" : "text-text-mute"}`}
                >
                  {opt.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold ${selected && !disabledByPolla ? "text-primary" : "text-text"}`}>
                    {opt.label}
                  </div>
                  <div className="text-text-mute text-sm mt-0.5">{opt.desc}</div>
                </div>
                {selected && !disabledByPolla && (
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

        {isPolla && (
          <p className="text-text-mute text-xs mt-2">
            Las pollas son privadas por default. Solo los participantes la ven.
          </p>
        )}

        {visibility === "code" && (
          <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-xl text-sm text-text-dim">
            Se generará un código de 6 dígitos automáticamente al crear el torneo.
          </div>
        )}
      </div>
    </WizardStepLayout>
  );
}
