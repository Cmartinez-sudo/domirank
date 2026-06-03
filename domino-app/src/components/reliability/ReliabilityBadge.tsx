"use client";

import { useState, useRef, useEffect } from "react";
import { getReliabilityBucket } from "@/lib/rating";

type Size = "xs" | "sm" | "md";

type Factors = {
  volume:      number | null;
  recency:     number | null;
  attestation: number | null;
  diversity:   number | null;
};

type Props = {
  /** 0-100 score. */
  score: number;
  size?: Size;
  /** Default: only bucket label. With showScore, prefix "70% · Confiable". */
  showScore?: boolean;
  /** When provided, renders an "i" tooltip with the 4-factor breakdown. */
  factors?: Factors | null;
  /** Updated_at to show "actualizado: hace X" inside tooltip. */
  updatedAt?: string | null;
  className?: string;
};

/**
 * Visual badge for the reliability score (0-100). Color + label come from
 * getReliabilityBucket() — 4 buckets per RELIABILITY_NR_HOW_IT_WORKS.md.
 *
 * If `factors` is provided, the badge becomes an interactive tooltip
 * exposing the volume/recency/attestation/diversity breakdown. Without
 * factors it's a plain non-interactive pill.
 */
export function ReliabilityBadge({
  score,
  size = "sm",
  showScore = false,
  factors,
  updatedAt,
  className = "",
}: Props) {
  const bucket = getReliabilityBucket(score);

  const sizeClass =
    size === "xs" ? "text-[10px] px-1.5 py-0" :
    size === "md" ? "text-sm px-2.5 py-1" :
    "text-xs px-2 py-0.5";

  const pillContent = (
    <>
      {showScore && (
        <span className="font-mono tabular-nums mr-1.5">{score}%</span>
      )}
      <span>{bucket.label}</span>
    </>
  );

  // Plain pill — no tooltip, no interactivity.
  if (!factors) {
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-full border border-current/30 ${sizeClass} ${bucket.className} ${className}`}
        title={`Confiabilidad: ${score}% — ${bucket.label}`}
      >
        {pillContent}
      </span>
    );
  }

  // Interactive variant with tooltip showing the 4-factor breakdown.
  return (
    <ReliabilityBadgeWithTooltip
      score={score}
      bucket={bucket}
      factors={factors}
      updatedAt={updatedAt}
      sizeClass={sizeClass}
      className={className}
    >
      {pillContent}
    </ReliabilityBadgeWithTooltip>
  );
}

function ReliabilityBadgeWithTooltip({
  score,
  bucket,
  factors,
  updatedAt,
  sizeClass,
  className,
  children,
}: {
  score: number;
  bucket: ReturnType<typeof getReliabilityBucket>;
  factors: Factors;
  updatedAt?: string | null;
  sizeClass: string;
  className: string;
  children: React.ReactNode;
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

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(v => !v); }}
        aria-expanded={open}
        aria-label={`Confiabilidad: ${score}% — ${bucket.label}. Tocar para detalles`}
        className={`inline-flex items-center justify-center font-semibold rounded-full border border-current/30 min-h-9 md:min-h-8 ${sizeClass} ${bucket.className} ${className} hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40`}
      >
        {children}
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute top-full mt-1.5 right-0 z-50 w-72 rounded-xl border border-border bg-surface shadow-lg p-4 text-left text-text"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">Confiabilidad</span>
            <span className={`font-mono font-bold ${bucket.className.split(" ")[0]}`}>
              {score}%
            </span>
          </div>
          <p className="text-text-dim text-xs mb-3">
            Mide qué tan confiable es tu rating, no qué tan bueno eres.
            Más partidas atestiguadas, recientes y diversas = más confianza.
          </p>
          <FactorRow label="Volumen"     value={factors.volume}      hint="35% del peso · meta: 30 partidas confirmadas" />
          <FactorRow label="Recencia"    value={factors.recency}     hint="25% · meta: 10 partidas últimos 60 días" />
          <FactorRow label="Atestiguado" value={factors.attestation} hint="25% · % de tus partidas con consenso" />
          <FactorRow label="Diversidad"  value={factors.diversity}   hint="15% · meta: 15 oponentes distintos" />
          {updatedAt && (
            <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-text-mute">
              Actualizado: {formatRelative(updatedAt)}
            </div>
          )}
        </span>
      )}
    </span>
  );
}

function FactorRow({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  const pct = value == null ? 0 : Math.round(value * 100);
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-dim">{label}</span>
        <span className="font-mono tabular-nums text-text">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/80 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-text-mute mt-0.5">{hint}</p>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60)     return "hace un momento";
  if (diffSec < 3600)   return `hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400)  return `hace ${Math.floor(diffSec / 3600)} h`;
  return `hace ${Math.floor(diffSec / 86400)} d`;
}
