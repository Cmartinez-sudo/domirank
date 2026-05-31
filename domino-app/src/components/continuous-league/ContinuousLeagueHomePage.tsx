"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContinuousLeagueLeaderboard } from "./ContinuousLeagueLeaderboard";
import { PartnerStatsCard } from "./PartnerStatsCard";
import { ContinuousLeagueMatchesList } from "./ContinuousLeagueMatchesList";
import { ContinuousLeagueContinueOrStartButton } from "./ContinuousLeagueContinueOrStartButton";
import { ContinuousLeagueChampionCard } from "./ContinuousLeagueChampionCard";
import { ContinuousLeagueProgressCard } from "./ContinuousLeagueProgressCard";
import { NewMatchInContinuousLeagueModal } from "./NewMatchInContinuousLeagueModal";
import { NewSeasonDialog } from "./NewSeasonDialog";
import { CloseContinuousLeagueDialog } from "./CloseContinuousLeagueDialog";
import { ContinuousLeagueSeasonSelector } from "./ContinuousLeagueSeasonSelector";
import type { ContinuousLeagueStandingsRow, ContinuousLeagueMatchRow, ContinuousLeagueDayFilter } from "@/types/continuous-league";

type Props = {
  tournament: {
    id:             string;
    name:           string;
    is_open_ended:  boolean;
    current_season: number;
    created_by:     string;
    status:         "open" | "in_progress" | "finished" | "cancelled";
    total_rounds:   number | null;
    created_at:     string;
  };
  currentUserId:  string;
  standings:      ContinuousLeagueStandingsRow[];
  rosterUserIds:  string[];
  matches:        ContinuousLeagueMatchRow[];
  activeMatch:    ContinuousLeagueMatchRow | null;
  playerCount:    number;
  userNames:      Record<string, string>;
  viewingSeason:  number;
  /** Tab activo del leaderboard. "all" si la polla no es continua. */
  dayFilter:      ContinuousLeagueDayFilter;
  /** Cantidad de partidas finalizadas hoy (TZ Caracas). */
  todayCount:     number;
  /** Cantidad de partidas finalizadas totales (current_season). */
  allCount:       number;
};

export function ContinuousLeagueHomePage({
  tournament, currentUserId, standings, rosterUserIds, matches, activeMatch,
  playerCount, userNames, viewingSeason, dayFilter, todayCount, allCount,
}: Props) {
  const router = useRouter();
  const [showNewMatchModal, setShowNewMatchModal] = useState(false);
  const [showNewSeasonDialog, setShowNewSeasonDialog] = useState(false);
  const [showCloseContinuousLeagueDialog, setShowCloseContinuousLeagueDialog] = useState(false);

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
      <ContinuousLeagueSeasonSelector
        tournamentId={tournament.id}
        currentSeason={tournament.current_season}
        viewingSeason={viewingSeason}
      />

      {/* Progress card — solo en polla cerrada con rondas pactadas */}
      {!tournament.is_open_ended && tournament.total_rounds && !isHistorical && (
        <ContinuousLeagueProgressCard
          finishedCount={finishedMatchesCount}
          targetCount={tournament.total_rounds}
          rounds={tournament.total_rounds}
        />
      )}

      {/* Leaderboard */}
      <ContinuousLeagueLeaderboard
        rows={standings}
        currentUserId={currentUserId}
        showTabs={tournament.is_open_ended}
        activeTab={dayFilter}
        tournamentId={tournament.id}
        createdAt={tournament.created_at}
        todayCount={todayCount}
        allCount={allCount}
        seasonParam={viewingSeason === tournament.current_season ? null : viewingSeason}
      />

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
        <ContinuousLeagueContinueOrStartButton
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
            onClick={() => setShowCloseContinuousLeagueDialog(true)}
            className="btn-ghost text-sm"
          >
            {tournament.is_open_ended ? "Cerrar polla" : "Finalizar polla"}
          </button>
        </div>
      )}

      {/* Champion card — solo si la polla terminó */}
      {champion && (
        <ContinuousLeagueChampionCard
          championName={champion.display_name ?? champion.username}
          pointsFor={champion.total_points}
          wins={champion.wins}
          losses={champion.losses}
        />
      )}

      {/* Matches list */}
      <ContinuousLeagueMatchesList matches={matches} userNames={userNames} />

      {/* Modals */}
      {showNewMatchModal && (
        <NewMatchInContinuousLeagueModal
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
      {showCloseContinuousLeagueDialog && (
        <CloseContinuousLeagueDialog
          tournamentId={tournament.id}
          onClose={() => setShowCloseContinuousLeagueDialog(false)}
        />
      )}
    </div>
  );
}
