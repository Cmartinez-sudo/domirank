"use client";

type Props = {
  onContinue?: () => void;
  continueLabel?: string;
  disabled?: boolean;
  pending?: boolean;
  /** Texto opcional debajo del botón */
  hint?: string;
  type?: "button" | "submit";
};

export function StepFooter({
  onContinue,
  continueLabel = "Continuar",
  disabled = false,
  pending = false,
  hint,
  type = "button",
}: Props) {
  return (
    <div
      className="fixed bottom-0 inset-x-0 z-20 bg-bg/95 backdrop-blur-md border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-3 space-y-1.5">
        <button
          type={type}
          onClick={type === "button" ? onContinue : undefined}
          disabled={disabled || pending}
          aria-busy={pending}
          className="btn-primary w-full text-base py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              Procesando…
            </span>
          ) : continueLabel}
        </button>
        {hint && (
          <p className="text-text-mute text-xs text-center">{hint}</p>
        )}
      </div>
    </div>
  );
}
