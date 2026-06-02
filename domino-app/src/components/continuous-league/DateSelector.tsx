"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  tournamentId: string;
  /** Día seleccionado actualmente en formato YYYY-MM-DD. */
  selectedDay: string;
  /** session_day "hoy" (calculado en server con TZ Caracas, cutoff 5am). YYYY-MM-DD. */
  todaySessionDay: string;
  /** Todos los session_days con partidas confirmadas, DESC (más reciente primero). */
  availableDays: string[];
  /** Preservar ?season=N al navegar a otro día. */
  seasonParam?: number | null;
};

/** Construye un Date "midnight UTC" a partir de YYYY-MM-DD, para formateo
 *  consistente sin que la TZ del browser corra el día. */
function toDateUTC(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatSpanish(yyyymmdd: string): string {
  return toDateUTC(yyyymmdd).toLocaleDateString("es", {
    weekday: "long",
    day:     "2-digit",
    month:   "long",
    timeZone: "UTC",
  });
}

/** Resta `days` días a YYYY-MM-DD y devuelve YYYY-MM-DD. */
function shiftDay(yyyymmdd: string, days: number): string {
  const d = toDateUTC(yyyymmdd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildHref(
  tournamentId: string,
  day: string,
  todaySessionDay: string,
  season: number | null | undefined,
): string {
  const params = new URLSearchParams();
  // Si el día es "hoy", usamos ?day=today para que el SSR llame al RPC con null
  params.set("day", day === todaySessionDay ? "today" : day);
  if (season != null) params.set("season", String(season));
  return `/tournaments/${tournamentId}?${params.toString()}`;
}

/**
 * Selector de fecha para el leaderboard "Hoy" de polla continua.
 *
 * Presets:
 *  - Hoy        — el session_day actual.
 *  - Ayer       — session_day - 1d (solo si tuvo partidas).
 *  - Última sesión — el session_day más reciente que no sea hoy ni ayer.
 *  - Elegir fecha — input nativo type="date" con min/max y validación JS
 *                   contra availableDays.
 *
 * No se renderiza si availableDays está vacío.
 */
export function DateSelector({
  tournamentId, selectedDay, todaySessionDay, availableDays, seasonParam,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pickerWarning, setPickerWarning] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al click outside
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Si no hay días con partidas, no renderizamos el selector.
  if (availableDays.length === 0) return null;

  // Set lookup para validación rápida
  const availableSet = new Set(availableDays);

  // "Ayer" desde hoy
  const yesterdayDay = shiftDay(todaySessionDay, -1);
  const hasYesterday = availableSet.has(yesterdayDay);

  // "Última sesión" = el session_day más reciente en availableDays
  // que NO sea hoy y NO sea ayer.
  const lastSession = availableDays.find(
    (d) => d !== todaySessionDay && d !== yesterdayDay,
  ) ?? null;

  // Min/max para el native date input. Si hoy NO está en availableDays
  // (típico antes de la 1era partida del día), permitimos hasta hoy igual
  // así el usuario puede ver "Hoy" — pero la validación JS evitará navegar.
  // El max real = mayor entre todaySessionDay y newest available.
  const newestAvailable = availableDays[0]; // ya viene DESC
  const oldestAvailable = availableDays[availableDays.length - 1];
  const maxDay = todaySessionDay > newestAvailable ? todaySessionDay : newestAvailable;
  const minDay = oldestAvailable;

  // Label del trigger
  const isToday = selectedDay === todaySessionDay;
  const triggerLabel = isToday
    ? "Cambiar fecha"
    : formatSpanish(selectedDay);

  function onPickerChange(value: string) {
    setPickerWarning(null);
    if (!value) return;
    if (!availableSet.has(value)) {
      setPickerWarning("Sin partidas ese día");
      return;
    }
    setOpen(false);
    router.push(buildHref(tournamentId, value, todaySessionDay, seasonParam));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-2 hover:bg-surface-2 text-sm font-medium transition w-full justify-between sm:w-auto"
      >
        <span className="capitalize">{triggerLabel}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Elegir fecha"
          className="absolute left-0 right-0 sm:right-auto sm:min-w-[280px] mt-2 z-20 rounded-xl bg-surface border border-border shadow-xl p-2 space-y-1"
        >
          <div className="text-text-mute text-[10px] uppercase tracking-wider px-2 py-1">
            Elegir fecha
          </div>

          {/* Hoy */}
          <DateOption
            href={buildHref(tournamentId, todaySessionDay, todaySessionDay, seasonParam)}
            selected={selectedDay === todaySessionDay}
            primary={`Hoy`}
            secondary={`(${formatSpanish(todaySessionDay)})`}
            onClick={() => setOpen(false)}
          />

          {/* Ayer (solo si en availableDays) */}
          {hasYesterday && (
            <DateOption
              href={buildHref(tournamentId, yesterdayDay, todaySessionDay, seasonParam)}
              selected={selectedDay === yesterdayDay}
              primary={`Ayer`}
              secondary={`(${formatSpanish(yesterdayDay)})`}
              onClick={() => setOpen(false)}
            />
          )}

          {/* Última sesión (solo si !== hoy && !== ayer) */}
          {lastSession && (
            <DateOption
              href={buildHref(tournamentId, lastSession, todaySessionDay, seasonParam)}
              selected={selectedDay === lastSession}
              primary={`Última sesión`}
              secondary={`(${formatSpanish(lastSession)})`}
              onClick={() => setOpen(false)}
            />
          )}

          {/* Elegir fecha — input nativo */}
          <div className="px-2 py-2 border-t border-border/40 mt-1">
            <label className="block text-xs text-text-mute mb-1">
              Elegir fecha
            </label>
            <input
              type="date"
              min={minDay}
              max={maxDay}
              value={availableSet.has(selectedDay) ? selectedDay : ""}
              onChange={(e) => onPickerChange(e.target.value)}
              className="block w-full bg-bg-2 rounded-lg px-2 py-1.5 text-sm border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {pickerWarning && (
              <div className="text-danger text-xs mt-1" role="alert">
                {pickerWarning}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DateOption({
  href, selected, primary, secondary, onClick,
}: {
  href:      string;
  selected:  boolean;
  primary:   string;
  secondary: string;
  onClick:   () => void;
}) {
  return (
    <Link
      href={href}
      role="option"
      aria-selected={selected}
      onClick={onClick}
      scroll={false}
      className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition ${
        selected ? "bg-primary/10 text-text" : "hover:bg-bg-2 text-text"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full border-2 shrink-0 ${
          selected ? "border-primary" : "border-text-mute"
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
      </span>
      <span className="font-medium">{primary}</span>
      <span className="text-text-mute text-xs capitalize">{secondary}</span>
    </Link>
  );
}
