"use client";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  /** Mensaje de error inline (validación cross-field) */
  error?: string;
  label?: string;
};

/**
 * Stepper "- N +" para cantidad de jugadores.
 * Spec F1.4 §Step 1.3.
 */
export function PlayersCountStepper({
  value,
  onChange,
  min = 4,
  max = 64,
  error,
  label = "Cantidad de jugadores",
}: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const dec = () => onChange(clamp(value - 1));
  const inc = () => onChange(clamp(value + 1));

  return (
    <div>
      <label className="label block mb-2" id="players-count-label">
        {label}
      </label>
      <div
        className={`flex items-stretch rounded-2xl border overflow-hidden ${
          error ? "border-danger/50 bg-danger/5" : "border-border bg-surface-2"
        }`}
        role="group"
        aria-labelledby="players-count-label"
      >
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          aria-label="Disminuir jugadores"
          className="flex-1 py-4 text-xl font-bold text-text hover:bg-surface-3 active:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          −
        </button>
        <div className="flex-1 flex items-center justify-center text-3xl font-bold tabular-nums">
          {value}
        </div>
        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          aria-label="Aumentar jugadores"
          className="flex-1 py-4 text-xl font-bold text-text hover:bg-surface-3 active:bg-surface-3 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          +
        </button>
      </div>
      {error && (
        <p
          className="mt-2 text-danger text-xs flex items-start gap-1.5"
          role="alert"
          aria-live="polite"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
