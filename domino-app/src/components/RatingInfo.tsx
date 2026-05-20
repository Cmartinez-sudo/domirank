"use client";

import { useState, useRef, useEffect } from "react";
import { SKILL_TIERS, tierFor, type SkillTier } from "@/lib/rating";

export function TierBadge({ display, className = "" }: { display: number; className?: string }) {
  const tier = tierFor(display);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}
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
            Tu rating OpenSkill interno (μ − 3σ) se mapea a una escala visible de 1 a 20.
            Anclas: 0 → 1.0 · 35 → 20.0.
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
