"use client";

import { useState } from "react";
import Link from "next/link";
import { PollaLeaderboard } from "./PollaLeaderboard";
import { PartnerStatsCard } from "./PartnerStatsCard";
import { PollaRoundsAccordion } from "./PollaRoundsAccordion";
import { NewMatchInPollaModal } from "./NewMatchInPollaModal";
import { NewSeasonDialog } from "./NewSeasonDialog";
import { ClosePollaDialog } from "./ClosePollaDialog";
import { PollaSeasonSelector } from "./PollaSeasonSelector";
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
  /** Roster real desde tournament_players. NO derivar de standings — éste
   *  puede venir vacío si la polla recién inició y nadie jugó todavía. */
  rosterUserIds: string[];
  rounds: PollaRoundGroup[];
  totalMatches: number;
  playerCount: number;
  userNames: Record<string, string>;
  /** Temporada que el usuario está viendo. Si !== current_season, estamos en
   *  modo histórico (read-only: sin "Nueva partida", sin acciones organizador). */
  viewingSeason: number;
};

export function PollaHomePage({
  tournament, currentUserId, standings, rosterUserIds, rounds, totalMatches, playerCount, userNames, viewingSeason,
}: Props) {
  const [showNewMatchModal, setShowNewMatchModal] = useState(false);
  const [showNewSeasonDialog, setShowNewSeasonDialog] = useState(false);
  const [showClosePollaDialog, setShowClosePollaDialog] = useState(false);

  const isOrganizer = tournament.created_by === currentUserId;
  const isClosed = tournament.status === "finished" || tournament.status === "cancelled";
  const isHistorical = viewingSeason !== tournament.current_season;

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
              {playerCount} jugadores · Temporada {viewingSeason} · {totalMatches} partidas
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span className="badge bg-primary/15 text-primary">Polla</span>
              <span className="badge bg-info/15 text-info">
                {tournament.is_open_ended ? "Indefinida" : "Cerrada"}
              </span>
              {isHistorical && (
                <span className="badge bg-surface-2 text-text-mute">Histórico</span>
              )}
            </div>
          </div>
          {!isClosed && !isHistorical && (
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

      {/* Season selector — solo aparece si hay temporadas históricas */}
      <PollaSeasonSelector
        tournamentId={tournament.id}
        currentSeason={tournament.current_season}
        viewingSeason={viewingSeason}
      />

      {/* Leaderboard */}
      <PollaLeaderboard rows={standings} currentUserId={currentUserId} />

      {/* Partner stats — solo si el current user es participante */}
      {meRow && (
        <PartnerStatsCard
          bestPartnerName={meRow.best_partner_name}
          bestPartnerWins={meRow.best_partner_wins}
          bestPartnerLosses={meRow.best_partner_losses}
          worstRivalName={meRow.worst_rival_name}
          worstRivalWins={meRow.worst_rival_wins}
          worstRivalLosses={meRow.worst_rival_losses}
        />
      )}

      {/* Rounds accordion */}
      <PollaRoundsAccordion
        rounds={rounds}
        currentRoundNumber={currentRoundNumber}
        userNames={userNames}
      />

      {/* Acciones organizer — solo en vista actual (no histórico) */}
      {isOrganizer && !isHistorical && (
        <div className="card space-y-2">
          <div className="text-text-mute text-xs uppercase tracking-wide mb-2">Acciones del organizador</div>
          <Link
            href={`/tournaments/${tournament.id}/manage`}
            className="btn-secondary w-full text-center"
          >
            Editar nombre
          </Link>
          {!isClosed && (
            <>
              <button
                type="button"
                onClick={() => setShowNewSeasonDialog(true)}
                className="btn w-full border border-danger/40 text-danger hover:bg-danger/10 active:scale-[.97]"
              >
                Nueva temporada
              </button>
              <button
                type="button"
                onClick={() => setShowClosePollaDialog(true)}
                className="btn w-full border border-danger/40 text-danger hover:bg-danger/10 active:scale-[.97]"
              >
                Cerrar polla
              </button>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {showNewMatchModal && (
        <NewMatchInPollaModal
          tournamentId={tournament.id}
          rosterUserIds={rosterUserIds}
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
      {showClosePollaDialog && (
        <ClosePollaDialog
          tournamentId={tournament.id}
          onClose={() => setShowClosePollaDialog(false)}
        />
      )}
    </div>
  );
}
