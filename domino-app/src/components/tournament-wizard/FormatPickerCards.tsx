"use client";

import type { Format } from "@/hooks/useTournamentDraft";

type FormatCard = {
  value: Format;
  icon: string;
  label: string;
  desc: string;
};

const FORMATS: FormatCard[] = [
  {
    value: "swiss",
    icon: "🏆",
    label: "Suizo",
    desc: "Rondas balanceadas por puntaje",
  },
  {
    value: "round_robin",
    icon: "👥",
    label: "Round Robin parejas",
    desc: "Todas las parejas se enfrentan",
  },
  {
    value: "single_elim",
    icon: "🎯",
    label: "Eliminación directa",
    desc: "Pierdes una, sales. Bracket.",
  },
];

type Props = {
  value: Format | undefined;
  onChange: (next: Format) => void;
};

/**
 * Grid de cards de selección de formato.
 * Post-Fase-5: 3 cards (Swiss / Round Robin / Single Elim). Liga continua
 * fue reemplazada por Grupos.
 */
export function FormatPickerCards({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Formato del torneo">
      {FORMATS.map((f) => {
        const selected = value === f.value;
        return (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(f.value)}
            className={`flex flex-col gap-2 p-3 rounded-2xl border text-left transition-all min-h-[110px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              selected
                ? "bg-primary/10 border-primary/50 shadow-sm"
                : "bg-surface-2 border-border hover:border-border-strong hover:bg-surface-3"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-2xl leading-none" aria-hidden="true">
                {f.icon}
              </span>
              {selected && (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary shrink-0"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <div
                className={`font-semibold text-sm ${
                  selected ? "text-primary" : "text-text"
                }`}
              >
                {f.label}
              </div>
              <div className="text-text-mute text-xs mt-1">{f.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
