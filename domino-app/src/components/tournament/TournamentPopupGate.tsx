"use client";

/**
 * TournamentPopupGate
 *
 * Client Component que monta <TournamentPopup> con los datos pre-cargados
 * desde el Server Component padre (AppShell / layout.tsx).
 *
 * Se mantiene como wrapper separado para que AppShell pueda seguir siendo
 * un Client Component sin necesitar async data fetching.
 */

import { TournamentPopup } from "./TournamentPopup";
import type { PendingTournament } from "./TournamentPopup";

export function TournamentPopupGate({
  pendingTournaments,
}: {
  pendingTournaments: PendingTournament[];
}) {
  return <TournamentPopup pendingTournaments={pendingTournaments} />;
}
