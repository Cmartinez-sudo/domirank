"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { resolveHeroCta } from "@/lib/hero-next-match-logic";
import type { PairingForHero } from "@/lib/hero-next-match-logic";

// ─── Re-export for consumers that import from this module ─────
export { resolveHeroCta };
export type { HeroCta } from "@/lib/hero-next-match-logic";

// ─── Types ───────────────────────────────────────────────────

type PlayerProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type HeroNextMatchProps = {
  pairing: PairingForHero;
  profiles: PlayerProfile[];
  tournamentId: string;
  timeLimitMinutes: number | null;
  /** Total de mesas del torneo. Si > 1 se muestra el número de mesa del pairing. */
  numBoards?: number;
};

// ─── Component ───────────────────────────────────────────────

export function HeroNextMatch({
  pairing,
  profiles,
  tournamentId,
  timeLimitMinutes,
  numBoards = 1,
}: HeroNextMatchProps) {
  const cta = resolveHeroCta(pairing, tournamentId);

  function getProfiles(ids: string[]) {
    return ids
      .map((id) => profiles.find((p) => p.id === id))
      .filter((p): p is PlayerProfile => p !== undefined);
  }

  const teamA = getProfiles(pairing.team_a_user_ids);
  const teamB = getProfiles(pairing.team_b_user_ids);

  function TeamDisplay({ team }: { team: PlayerProfile[] }) {
    if (team.length === 0) {
      return <span className="text-text-mute italic text-sm">Por definir</span>;
    }
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex -space-x-2">
          {team.map((p) => (
            <span key={p.id} className="rounded-full ring-2 ring-bg-2">
              <Avatar player={p} size={36} />
            </span>
          ))}
        </div>
        <span className="text-sm font-medium text-text text-center leading-tight">
          {team.map((p) => p.display_name ?? p.username).join(" & ")}
        </span>
      </div>
    );
  }

  const statusLabel = (() => {
    if (!pairing.match_id) return "Lista para jugar";
    if (pairing.match?.status === "in_progress") return "En curso";
    if (pairing.match?.status === "pending_attestation") return "Esperando confirmación";
    return null;
  })();

  return (
    <section className="card overflow-hidden border-primary/30" style={{ background: "linear-gradient(135deg, rgba(16,185,129,.08), rgba(5,150,105,.04))" }}>
      {/* Label */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm text-primary uppercase tracking-wide">
          Tu próxima partida
        </h2>
        <div className="flex items-center gap-2">
          {statusLabel && (
            <span className="badge bg-primary/15 text-primary text-xs">{statusLabel}</span>
          )}
          <span className="text-xs text-text-mute">Ronda {pairing.round}</span>
        </div>
      </div>

      {/* Teams vs Teams */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <TeamDisplay team={teamA} />
        <span className="text-xl font-bold text-text-mute shrink-0">vs</span>
        <TeamDisplay team={teamB} />
      </div>

      {/* Meta info */}
      {(timeLimitMinutes || (numBoards > 1 && pairing.board)) && (
        <div className="flex items-center justify-center gap-3 mb-4 text-xs text-text-mute">
          {numBoards > 1 && pairing.board && (
            <span className="badge bg-surface-3 text-text-dim px-2 py-0.5">
              Mesa {pairing.board}
            </span>
          )}
          {timeLimitMinutes && (
            <span>Tiempo limite: {timeLimitMinutes} min</span>
          )}
        </div>
      )}

      {/* CTA */}
      <Link
        href={cta.href}
        className={cta.variant === "primary" ? "btn-primary w-full text-center" : "btn-ghost w-full text-center"}
      >
        {cta.label}
      </Link>
    </section>
  );
}

// ─── Waiting state (status = 'open') ─────────────────────────

export type HeroWaitingProps = {
  inscribedCount: number;
  maxPlayers: number;
  isOrganizer: boolean;
  tournamentId: string;
  allPairsReady: boolean;
};

export function HeroWaiting({
  inscribedCount,
  maxPlayers,
  isOrganizer,
  tournamentId,
  allPairsReady,
}: HeroWaitingProps) {
  return (
    <section className="card border-border">
      <div className="flex items-center gap-3 mb-3">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-mute shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <h2 className="font-semibold">Esperando para iniciar</h2>
      </div>
      <p className="text-text-mute text-sm mb-1">
        El torneo comienza cuando el organizador lo confirme.
      </p>
      <p className="text-text-dim text-sm mb-4">
        Inscritos: {inscribedCount} de {maxPlayers}
      </p>

      {isOrganizer && allPairsReady && (
        <Link
          href={`/tournaments/${tournamentId}/manage`}
          className="btn-primary w-full text-center"
        >
          Iniciar torneo
        </Link>
      )}
      {isOrganizer && !allPairsReady && (
        <Link
          href={`/tournaments/${tournamentId}/manage`}
          className="btn-ghost w-full text-center"
        >
          Gestionar inscritos
        </Link>
      )}
    </section>
  );
}
