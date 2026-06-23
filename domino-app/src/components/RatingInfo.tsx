"use client";

import { useState, useRef, useEffect } from "react";
import { SKILL_TIERS, tierFor, type SkillTier } from "@/lib/rating";

export function TierBadge({
  display,
  size = "sm",
  className = "",
}: {
  display: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const tier = tierFor(display);
  const sizeClass =
    size === "xs" ? "text-[10px] px-1.5 py-0" :
    size === "md" ? "text-sm px-2.5 py-1" :
    "text-xs px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${sizeClass} ${className}`}
      style={{ background: `${tier.color}22`, color: tier.color, border: `1px solid ${tier.color}44` }}
    >
      {tier.name}
    </span>
  );
}

export function RatingInfoTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label="Cómo se calcula DomiRank"
        className="w-5 h-5 rounded-full border border-border text-text-mute text-xs font-bold leading-none hover:border-primary hover:text-primary transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-72 rounded-xl border border-border bg-surface shadow-lg p-4 text-left"
          role="tooltip"
        >
          <div className="text-sm font-semibold mb-2">Escala DomiRank 1-20</div>
          <p className="text-text-dim text-xs mb-3">
            Tu Elo interno se mapea a una escala visible de 1 a 20.
            Anclas: Elo 1000 → 1.0 · Elo 2200 → 20.0. Empiezas en Elo 1500 ≈ 8.9.
          </p>
          <div className="space-y-1">
            {SKILL_TIERS.map((t) => (
              <div key={t.name} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: t.color }}
                />
                <span style={{ color: t.color }} className="font-medium w-20">{t.name}</span>
                <span className="text-text-mute">{t.min} – {t.max}</span>
              </div>
            ))}
          </div>
          {/* arrow */}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0"
            style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid var(--color-border)" }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Botón "i" compacto dentro de un <th>. Muestra tooltip al click.
 * Se cierra al click fuera.
 *
 * Uso:
 *   <th><ColHeader label="DomiRank" tooltip="tu rating visible 1-20..." /></th>
 *
 * El align controla a qué lado se posiciona el tooltip (default "center").
 * Usa "right" para columnas alineadas a la derecha (las numéricas).
 */
export function ColHeader({
  label,
  tooltip,
  align = "left",
  className = "",
}: {
  label: React.ReactNode;
  tooltip: string;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const popPos =
    align === "right" ? "right-0" :
    align === "center" ? "left-1/2 -translate-x-1/2" :
    "left-0";

  return (
    <span ref={ref} className={`relative inline-flex items-center gap-1 ${className}`}>
      <span>{label}</span>
      <button
        type="button"
        aria-label={`Información sobre ${typeof label === "string" ? label : "columna"}`}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-border/60 text-text-mute text-[9px] font-bold leading-none hover:border-primary hover:text-primary transition-colors"
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
      >
        i
      </button>
      {open && (
        <span
          className={`absolute top-full mt-1.5 ${popPos} z-50 w-56 rounded-lg border border-border bg-surface shadow-lg p-3 text-text-dim text-[11px] leading-relaxed normal-case tracking-normal font-normal text-left whitespace-normal`}
          role="tooltip"
        >
          {tooltip}
        </span>
      )}
    </span>
  );
}

/**
 * Tooltip explicando las columnas del Ranking.
 * Post-Fase-A: solo DomiRank Global (sin tabs).
 */
export function LeaderboardColumnsInfo() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const rows: Array<{ k: string; t: string }> = [
    { k: "#", t: "Posición en el ranking. Top 3 marcados con medalla." },
    { k: "Jugador", t: "Username y display name. Click para ir al perfil." },
    {
      k: "DomiRank",
      t: "Tu rating visible (1-20). Promedio ponderado por partidas de tus buckets activos (d6 + d9 parejas). Elo 1000 → 1.0, Elo 2200 → 20.0.",
    },
    { k: "Elo", t: "Rating Elo interno. Empieza en 1500. Sube al ganar, baja al perder. Primeras 10 partidas son Provisional (K=40, se mueve rápido)." },
    { k: "Partidas", t: "Total de partidas confirmadas (d6 + d9 parejas). Mínimo 5 para aparecer en el ranking." },
    { k: "d6 / d9", t: "Partidas en doble-6 · partidas en doble-9 (ambas en parejas)." },
  ];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-label="Qué significa cada columna"
        className="w-5 h-5 rounded-full border border-border text-text-mute text-xs font-bold leading-none hover:border-primary hover:text-primary transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 right-0 z-50 w-80 rounded-xl border border-border bg-surface shadow-lg p-4 text-left"
          role="tooltip"
        >
          <div className="text-sm font-semibold mb-3">Columnas del Ranking</div>
          <dl className="space-y-2.5">
            {rows.map((r) => (
              <div key={r.k} className="grid grid-cols-[5rem_1fr] gap-3">
                <dt className="text-xs font-semibold text-primary font-mono">{r.k}</dt>
                <dd className="text-xs text-text-dim leading-relaxed">{r.t}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 pt-3 border-t border-border/50 text-xs text-text-mute leading-relaxed">
            <strong className="text-text-dim">Importante:</strong> si solo juegas un set (e.g., solo doble-6), tu DomiRank Global = tu Elo en ese set. Los sets sin partidas no cuentan.
          </div>
        </div>
      )}
    </div>
  );
}
