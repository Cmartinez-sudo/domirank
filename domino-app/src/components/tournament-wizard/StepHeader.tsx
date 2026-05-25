"use client";

import { useRouter } from "next/navigation";

type Props = {
  currentStep: number;
  totalSteps?: number;
  title?: string;
  onBack?: () => void;
};

const TOTAL = 9;

export function StepHeader({ currentStep, totalSteps = TOTAL, title = "Nuevo torneo", onBack }: Props) {
  const router = useRouter();
  const progress = Math.round((currentStep / totalSteps) * 100);

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (currentStep <= 1) {
      router.push("/tournaments");
    } else {
      router.push(`/tournaments/new/step-${currentStep - 1}`);
    }
  }

  return (
    <header className="sticky top-0 z-20 bg-bg/95 backdrop-blur-md border-b border-border"
      style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="max-w-2xl mx-auto px-4">
        <div className="h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Volver"
            className="flex items-center justify-center w-11 h-11 -ml-2 rounded-full hover:bg-surface-2 active:bg-surface-3 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-text-mute font-medium truncate">
              {title} &middot; Paso {currentStep} de {totalSteps}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="pb-3">
          <div
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Paso ${currentStep} de ${totalSteps}`}
            className="h-1.5 bg-surface-3 rounded-full overflow-hidden"
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out motion-reduce:transition-none"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #10b981, #059669)",
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
