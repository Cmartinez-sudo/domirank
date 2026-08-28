"use client";

import {
  COUNT_RULES,
  PRESETS,
  PRESET_ORDER,
  type CountRule,
  type PresetId,
} from "@/lib/modalidades";

type Props = {
  /** Regla de conteo actualmente seleccionada — determina qué chips se muestran. */
  countRule: CountRule;
  onCountRuleChange: (next: CountRule) => void;
  /** Preset actualmente seleccionado. null = estado "Personalizado" implícito. */
  preset: PresetId | null;
  onPresetChange: (next: PresetId) => void;
};

/**
 * Layout 2 para el wizard de torneo:
 *  - 2 tarjetas de count_rule (fila superior).
 *  - Chips de preset filtrados por count_rule (Pregunta 11A: filtrado dinámico).
 *
 * Los chips NO incluyen "personalizado" — ese estado se refleja implícitamente
 * al deseleccionarlos (Pregunta 10A).
 */
export function ModalityChips({
  countRule,
  onCountRuleChange,
  preset,
  onPresetChange,
}: Props) {
  const availablePresets = PRESET_ORDER.map((id) => PRESETS[id]).filter(
    (p) => p.countRule === countRule,
  );

  return (
    <div className="space-y-3">
      {/* Regla de conteo — 2 tarjetas */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
        role="radiogroup"
        aria-label="Regla de conteo"
      >
        {Object.values(COUNT_RULES).map((rule) => (
          <button
            key={rule.code}
            type="button"
            role="radio"
            aria-checked={countRule === rule.code}
            onClick={() => onCountRuleChange(rule.code)}
            className={`flex flex-col items-start gap-1 p-3 rounded-md border text-left transition-colors ${
              countRule === rule.code
                ? "bg-primary/10 border-primary/60"
                : "bg-surface-2 border-border hover:border-border-strong"
            }`}
            data-testid={`count-rule-${rule.code}`}
          >
            <div className="font-semibold text-sm">{rule.name}</div>
            <div className="text-text-mute text-xs">{rule.subtitle}</div>
          </button>
        ))}
      </div>

      {/* Chips de preset filtrados por count_rule */}
      <div
        className="flex gap-2 flex-wrap"
        role="radiogroup"
        aria-label="Preset"
      >
        {availablePresets.map((p) => {
          const selected = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPresetChange(p.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                selected
                  ? "bg-primary/10 border-primary/50 text-primary"
                  : "bg-surface-2 border-border text-text-mute hover:border-border-strong hover:bg-surface-3 hover:text-text"
              }`}
              data-testid={`preset-${p.id}`}
            >
              {p.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
