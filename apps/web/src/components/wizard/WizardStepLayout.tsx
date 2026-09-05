"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { StepHeader } from "@/components/tournament-wizard/StepHeader";

type ContentSize = "small" | "medium" | "large";

type PrimaryAction = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
  type?: "button" | "submit";
};

type Props = {
  currentStep: number;
  title?: string;
  children: ReactNode;
  primaryAction: PrimaryAction;
  hint?: string;
  /** Si true, el botón se renderiza siempre sticky (override del adaptive sizing) */
  forceSticky?: boolean;
  /** Override del back nav (default: step-{currentStep - 1}). Útil cuando
   *  un step skipea otro (e.g., polla salta step 8). */
  onBack?: () => void;
};

const HEADER_FOOTER_SPACE = 120;

function useContentSize(
  mainRef: React.RefObject<HTMLElement | null>,
  forceSticky: boolean,
): ContentSize {
  const [size, setSize] = useState<ContentSize>("large");

  useEffect(() => {
    if (forceSticky || !mainRef.current) return;

    const el = mainRef.current;
    const ro = new ResizeObserver((entries) => {
      const contentHeight = entries[0].contentRect.height;
      const viewportHeight = window.innerHeight;

      if (contentHeight <= viewportHeight * 0.5) {
        setSize("small");
      } else if (contentHeight <= viewportHeight - HEADER_FOOTER_SPACE) {
        setSize("medium");
      } else {
        setSize("large");
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [mainRef, forceSticky]);

  return forceSticky ? "large" : size;
}

const MAIN_CLASS: Record<ContentSize, string> = {
  small: "flex-1 flex flex-col justify-center",
  medium: "flex-1",
  large: "flex-1 overflow-auto pb-32",
};

const FOOTER_CLASS: Record<ContentSize, string> = {
  small:
    "pb-[max(1rem,env(safe-area-inset-bottom))]",
  medium:
    "mt-6 pb-[max(1rem,env(safe-area-inset-bottom))]",
  large:
    "sticky bottom-0 bg-bg/95 backdrop-blur-md border-t border-border pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
};

function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span
        className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
        aria-hidden="true"
      />
      Procesando…
    </span>
  );
}

export function WizardStepLayout({
  currentStep,
  title,
  children,
  primaryAction,
  hint,
  forceSticky = false,
  onBack,
}: Props) {
  const mainRef = useRef<HTMLElement>(null);
  const size = useContentSize(mainRef, forceSticky);

  const {
    label,
    onClick,
    disabled = false,
    pending = false,
    type = "button",
  } = primaryAction;

  return (
    <div className="min-h-dvh flex flex-col">
      <StepHeader currentStep={currentStep} title={title} onBack={onBack} />

      <main ref={mainRef} className={MAIN_CLASS[size]}>
        {children}
      </main>

      <footer className={FOOTER_CLASS[size]}>
        <div className="max-w-2xl mx-auto px-4 space-y-1.5">
          <button
            type={type}
            onClick={type === "button" ? onClick : undefined}
            disabled={disabled || pending}
            aria-busy={pending}
            className="btn-primary w-full text-base py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? <Spinner /> : label}
          </button>
          {hint && (
            <p className="text-text-mute text-xs text-center">{hint}</p>
          )}
        </div>
      </footer>
    </div>
  );
}
