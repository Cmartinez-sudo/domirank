"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export type PendingTournament = {
  id: string;
  name: string;
  status: string;
  has_pending_match: boolean;
  next_match_id: string | null;
};

export function TournamentPopup({
  pendingTournaments,
}: {
  pendingTournaments: PendingTournament[];
}) {
  const [show, setShow] = useState(false);
  const [tournament, setTournament] = useState<PendingTournament | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>({ enabled: show, onEscape: dismiss });

  useEffect(() => {
    if (!pendingTournaments?.length) return;

    // Priorizar torneos con partida pendiente; si hay varios, el primero
    const t =
      pendingTournaments.find((x) => x.has_pending_match) ??
      pendingTournaments[0];

    const dismissedKey = `tournament-popup-dismissed:${t.id}`;
    if (sessionStorage.getItem(dismissedKey)) return;

    setTournament(t);
    setShow(true);
  }, [pendingTournaments]);

  function dismiss() {
    if (tournament) {
      sessionStorage.setItem(
        `tournament-popup-dismissed:${tournament.id}`,
        String(Date.now()),
      );
    }
    setShow(false);
  }

  if (!show || !tournament) return null;

  const ctaHref =
    tournament.has_pending_match && tournament.next_match_id
      ? `/matches/${tournament.next_match_id}/live`
      : `/tournaments/${tournament.id}`;

  const ctaLabel = tournament.has_pending_match
    ? "Ir a la partida"
    : "Ir al torneo";

  const bodyText = tournament.has_pending_match
    ? "Tienes una partida pendiente. Sigue jugando ahora."
    : "Hay novedades en tu torneo. Revisa el detalle."

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-popup-title"
      aria-describedby="tournament-popup-body"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        ref={trapRef}
        tabIndex={-1}
        className="relative bg-bg-2 border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-up-fade"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="absolute top-3 right-3 -m-1.5 p-2 rounded-md text-text-mute hover:text-text hover:bg-surface-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        {/* Trophy icon — SVG inline para cumplir con la regla de no emojis en strings,
            pero el spec usa el emoji en el componente JSX literal que sí está permitido */}
        <div className="mb-3 flex justify-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
            aria-hidden="true"
          >
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        </div>

        <h2
          id="tournament-popup-title"
          className="text-xl font-bold mb-2 text-center"
        >
          {tournament.name}
        </h2>
        <p id="tournament-popup-body" className="text-text-dim text-sm mb-5 text-center">{bodyText}</p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="btn-ghost flex-1"
          >
            Ahora no
          </button>
          <Link
            href={ctaHref}
            onClick={dismiss}
            className="btn-primary flex-1 text-center"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
