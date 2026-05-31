"use client";

import type { Modality } from "@/hooks/useTournamentDraft";

type Chip = {
  value: Modality;
  flag: string;
  label: string;
};

const CHIPS: Chip[] = [
  { value: "ven", flag: "🇻🇪", label: "VE" },
  { value: "dom", flag: "🇩🇴", label: "DO" },
  { value: "cub", flag: "🇨🇺", label: "CU" },
  { value: "pri", flag: "🇵🇷", label: "PR" },
  { value: "custom", flag: "⚙", label: "Custom" },
];

type Props = {
  value: Modality;
  onChange: (next: Modality) => void;
};

/**
 * Chips horizontales para seleccionar modalidad.
 * Spec F1.4 §Step 1.4.
 */
export function ModalityChips({ value, onChange }: Props) {
  return (
    <div
      className="flex gap-2 flex-wrap"
      role="radiogroup"
      aria-label="Modalidad de juego"
    >
      {CHIPS.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(c.value)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              selected
                ? "bg-primary/10 border-primary/50 text-primary"
                : "bg-surface-2 border-border text-text-mute hover:border-border-strong hover:bg-surface-3 hover:text-text"
            }`}
          >
            <span aria-hidden="true">{c.flag}</span>
            <span>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
