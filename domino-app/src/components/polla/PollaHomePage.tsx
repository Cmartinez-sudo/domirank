"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PollaLeaderboard } from "./PollaLeaderboard";
import { PartnerStatsCard } from "./PartnerStatsCard";
import { PollaMatchesList } from "./PollaMatchesList";
import { PollaContinueOrStartButton } from "./PollaContinueOrStartButton";
import { PollaChampionCard } from "./PollaChampionCard";
import { PollaProgressCard } from "./PollaProgressCard";
import { NewMatchInPollaModal } from "./NewMatchInPollaModal";
import { NewSeasonDialog } from "./NewSeasonDialog";
import { ClosePollaDialog } from "./ClosePollaDialog";
import { PollaSeasonSelector } from "./PollaSeasonSelector";
import type { PollaStandingsRow, PollaMatchRow } from "@/types/polla";

type Props = {
  tournament: {
    id:             string;
    name:           string;
    is_open_ended:  boolean;
    current_season: number;
    created_by:     string;
    status:         "open" | "in_progress" | "finished" | "cancelled";
    total_rounds:   number | null;
  };
  currentUserId:  string;
  standings:      PollaStandingsRow[];
  rosterUserIds:  string[];
  matches:        PollaMatchRow[];      // todas las partidas de la polla (no solo current season)
  activeMatch:    PollaMatchRow | null; // match con status='in_progress' de esta polla
  playerCount:    number;
  userNames:      Record<string, string>;
  /** Temporada que el usuario está viendo. Si !== current_season → modo histórico (read-only). */
  viewingSeason:  number;
};

export function PollaHomePage({
  tournament, currentUserId, standings, rosterUserIds, matches, activeMatch,
  playerCount, userNames, viewingSeason,
}: Props) {
  const router = useRouter();
  const [showNewMatchModal, setShowNewMatchModal] = useState(false);
  const [showNewSeasonDialog, setShowNewSeasonDialog] = useState(false);
  const [showClosePollaDialog, setShowClosePollaDialog] = useState(false);

  const isOrganizer = tournament.created_by === currentUserId;
  const isFinished  = tournament.status === "finished";
  const isClosed    = isFinished || tournament.status === "cancelled";
  const isActive    = tournament.status === "open" || tournament.status === "in_progress";
  const isHistorical = viewingSeason !== tournament.current_season;

  const meRow = standings.find((r) => r.user_id === currentUserId);
  const totalMatches = matches.filter((m) => m.status !== "in_progress").length;
  const finishedMatchesCount = totalMatches;
  const champion = isFinished && standings.length > 0 ? standings[0] : null;

  const activeMatchDisplay = activeMatch
    ? {
        id:          activeMatch.match_id,
        team_a_name: activeMatch.team_a_user_ids.map((uid) => userNames[uid] ?? "?").join(" & "),
        team_b_name: activeMatch.team_b_user_ids.map((uid) => userNames[uid] ?? "?").join(" & "),
        score_a:     activeMatch.score_a,
        score_b:     activeMatch.score_b,
      }
    : null;

  return (
    <div className="max-w-[720px] mx-auto space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <Link href="/tournaments" className="inline-flex items-center gap-1 text-sm text-text-mute hover:text-text">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Atrás
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold flex items-center gap-2 truncate">
              🇻🇪 <span className="truncate">{tournament.name}</span>
            </h1>
            <div className="text-text-mute text-sm mt-1">
              {playerCount} jugadores · Temporada {viewingSeason} · {finishedMatchesCount} partidas
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span className="badge bg-primary/15 text-primary">Polla</span>
              <span className="badge bg-info/15 text-info">
                {tournament.is_open_ended ? "Continua" : "Cerrada"}
              </span>
              {isFinished && (
                <span className="badge bg-surface-2 text-text-mute">Finalizada</span>
              )}
              {isHistorical && (
                <span className="badge bg-surface-2 text-text-mute">Histórico</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Season selector — solo si hay temporadas históricas */}
      <PollaSeasonSelector
        tournamentId={tournament.id}
        currentSeason={tournament.current_season}
        viewingSeason={viewingSeason}
      />

      {/* Progress card — solo en polla cerrada con rondas pactadas */}
      {!tournament.is_open_ended && tournament.total_rounds && !isHistorical && (
        <PollaProgressCard
          finishedCount={finishedMatchesCount}
          targetCount={tournament.total_rounds}
          rounds={tournament.total_rounds}
        />
      )}

      {/* Leaderboard */}
      <PollaLeaderboard rows={standings} currentUserId={currentUserId} />

      {/* Partner stats — solo si el current user es del roster */}
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

      {/* Big button: continuar o nueva partida — solo en vista actual + polla activa */}
      {isActive && !isHistorical && (
        <PollaContinueOrStartButton
          activeMatch={activeMatchDisplay}
          onStartNew={() => setShowNewMatchModal(true)}
          onContinue={(matchId) => router.push(`/matches/${matchId}/live`)}
        />
      )}

      {/* Tools row del organizador */}
      {isOrganizer && !isHistorical && isActive && (
        <div className="flex flex-wrap gap-2 items-center">
          <Link href={`/tournaments/${tournament.id}/manage`} className="btn-ghost text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline mr-1">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            Editar
          </Link>
          <button
            type="button"
            onClick={() => setShowNewSeasonDialog(true)}
            className="btn-ghost text-sm"
          >
            Nueva temporada
          </button>
          <button
            type="button"
            onClick={() => setShowClosePollaDialog(true)}
            className="btn-ghost text-sm"
          >
            {tournament.is_open_ended ? "Cerrar polla" : "Finalizar polla"}
          </button>
        </div>
      )}

      {/* Champion card — solo si la polla terminó */}
      {champion && (
        <PollaChampionCard
          championName={champion.display_name ?? champion.username}
          pointsFor={champion.total_points}
          wins={champion.wins}
          losses={champion.losses}
        />
      )}

      {/* Matches list */}
      <PollaMatchesList matches={matches} userNames={userNames} />

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
