"use client";

import { useState } from "react";
import Link from "next/link";
import { PollaLeaderboard } from "./PollaLeaderboard";
import { PartnerStatsCard } from "./PartnerStatsCard";
import { PollaRoundsAccordion } from "./PollaRoundsAccordion";
import { NewMatchInPollaModal } from "./NewMatchInPollaModal";
import { NewSeasonDialog } from "./NewSeasonDialog";
import type { PollaStandingsRow, PollaRoundGroup } from "@/types/polla";

type Props = {
  tournament: {
    id: string;
    name: string;
    is_open_ended: boolean;
    current_season: number;
    created_by: string;
    status: "open" | "in_progress" | "finished" | "cancelled";
  };
  currentUserId: string;
  standings: PollaStandingsRow[];
  rounds: PollaRoundGroup[];
  totalMatches: number;
  playerCount: number;
  userNames: Record<string, string>;
};

export function PollaHomePage({
  tournament, currentUserId, standings, rounds, totalMatches, playerCount, userNames,
}: Props) {
  const [showNewMatchModal, setShowNewMatchModal] = useState(false);
  const [showNewSeasonDialog, setShowNewSeasonDialog] = useState(false);

  const isOrganizer = tournament.created_by === currentUserId;
  const isClosed = tournament.status === "finished" || tournament.status === "cancelled";

  const meRow = standings.find((r) => r.user_id === currentUserId);

  const currentRoundNumber = Math.max(1, Math.ceil(totalMatches / Math.max(1, playerCount / 2)));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-text-mute hover:text-text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Atrás
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🇻🇪 {tournament.name}
            </h1>
            <div className="text-text-mute text-sm mt-1">
              {playerCount} jugadores · Temporada {tournament.current_season} · {totalMatches} partidas
            </div>
            <div className="flex gap-1.5 mt-2">
              <span className="badge bg-primary/15 text-primary">Polla</span>
              <span className="badge bg-info/15 text-info">
                {tournament.is_open_ended ? "Indefinida" : "Cerrada"}
              </span>
            </div>
          </div>
          {!isClosed && (
            <button
              type="button"
              onClick={() => setShowNewMatchModal(true)}
              className="btn-primary"
            >
              + Nueva partida
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <PollaLeaderboard rows={standings} currentUserId={currentUserId} />

      {/* Partner stats — solo si el current user es participante.
          NOTE: best_partner_wins/losses no vienen en PollaStandingsRow;
          mostramos solo el nombre (PartnerStatsCard maneja 0W-0L o "—"). */}
      {meRow && (
        <PartnerStatsCard
          bestPartnerName={meRow.best_partner_name}
          bestPartnerWins={0}
          bestPartnerLosses={0}
          worstRivalName={meRow.worst_rival_name}
          worstRivalWins={0}
          worstRivalLosses={0}
        />
      )}

      {/* Rounds accordion */}
      <PollaRoundsAccordion
        rounds={rounds}
        currentRoundNumber={currentRoundNumber}
        userNames={userNames}
      />

      {/* Acciones organizer */}
      {isOrganizer && (
        <div className="card space-y-2">
          <div className="text-text-mute text-xs uppercase tracking-wide mb-2">Acciones del organizador</div>
          <Link
            href={`/tournaments/${tournament.id}/manage`}
            className="btn-secondary w-full text-center"
          >
            Editar nombre
          </Link>
          {!isClosed && (
            <button
              type="button"
              onClick={() => setShowNewSeasonDialog(true)}
              className="btn w-full border border-danger/40 text-danger hover:bg-danger/10 active:scale-[.97]"
            >
              Nueva temporada
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showNewMatchModal && (
        <NewMatchInPollaModal
          tournamentId={tournament.id}
          rosterUserIds={standings.map((s) => s.user_id)}
          userNames={userNames}
          currentUserId={currentUserId}
          onClose={() => setShowNewMatchModal(false)}
        />
      )}
      {showNewSeasonDialog && (
        <NewSeasonDialog
          tournamentId={tournament.id}
          currentSeason={tournament.current_season}
          onClose={() => setShowNewSeasonDialog(false)}
        />
      )}
    </div>
  );
}
