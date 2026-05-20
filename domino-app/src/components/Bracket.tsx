"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";

type Pairing = {
  id: number;
  round: number;
  board: number;
  team_a_user_ids: string[];
  team_b_user_ids: string[];
  match_id: string | null;
  winner_side: "a" | "b" | null;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

function TeamCell({ userIds, profiles, isWinner }: { userIds: string[]; profiles: Profile[]; isWinner?: boolean }) {
  const players = userIds.map((id) => profiles.find((p) => p.id === id)).filter(Boolean) as Profile[];
  if (userIds.length === 0) {
    return <div className="text-text-mute text-xs italic px-2 py-1.5">BYE</div>;
  }
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${isWinner ? "bg-primary/10" : ""}`}>
      <div className="flex -space-x-1.5">
        {players.map((p) => (
          <Avatar key={p.id} player={p} size={22} />
        ))}
      </div>
      <span className={`text-xs font-medium truncate max-w-[80px] ${isWinner ? "text-primary" : "text-text-dim"}`}>
        {players.map((p) => p.display_name || p.username).join(" & ")}
      </span>
      {isWinner && <span className="text-primary text-xs ml-auto">✓</span>}
    </div>
  );
}

function PairingCard({ pairing, profiles, tournamentId, isOwner }: {
  pairing: Pairing;
  profiles: Profile[];
  tournamentId: string;
  isOwner: boolean;
}) {
  const content = (
    <div className={`border rounded-xl overflow-hidden text-sm ${
      pairing.winner_side ? "border-border/50 opacity-70" : "border-border hover:border-primary/40 transition-colors"
    }`}>
      <TeamCell
        userIds={pairing.team_a_user_ids}
        profiles={profiles}
        isWinner={pairing.winner_side === "a"}
      />
      <div className="h-px bg-border mx-2" />
      <TeamCell
        userIds={pairing.team_b_user_ids}
        profiles={profiles}
        isWinner={pairing.winner_side === "b"}
      />
      {!pairing.winner_side && isOwner && pairing.team_a_user_ids.length > 0 && pairing.team_b_user_ids.length > 0 && (
        <div className="px-2 pb-2 pt-1">
          <Link
            href={`/matches/new?tournament=${tournamentId}&pairing=${pairing.id}`}
            className="text-[10px] text-primary hover:underline"
          >
            + Jugar este pareo
          </Link>
        </div>
      )}
      {pairing.match_id && (
        <Link href={`/matches/${pairing.match_id}`} className="block px-2 pb-1.5 text-[10px] text-text-mute hover:text-primary">
          Ver partida →
        </Link>
      )}
    </div>
  );

  return content;
}

export function Bracket({ pairings, profiles, tournamentId, isOwner }: {
  pairings: Pairing[];
  profiles: Profile[];
  tournamentId: string;
  isOwner: boolean;
}) {
  if (pairings.length === 0) {
    return (
      <div className="text-center py-8 text-text-mute text-sm">
        El bracket se generará automáticamente al iniciar el torneo.
      </div>
    );
  }

  const rounds = Array.from(new Set(pairings.map((p) => p.round))).sort((a, b) => a - b);
  const maxRound = Math.max(...rounds);

  const roundNames = (round: number, total: number): string => {
    const remaining = total - round + 1;
    if (remaining === 1) return "Final";
    if (remaining === 2) return "Semifinal";
    if (remaining === 3) return "Cuartos";
    return `Ronda ${round}`;
  };

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-4 min-w-max pb-2">
        {rounds.map((round) => {
          const roundPairings = pairings.filter((p) => p.round === round).sort((a, b) => a.board - b.board);
          return (
            <div key={round} className="flex flex-col gap-2 w-[180px]">
              <div className="text-xs font-semibold text-text-mute uppercase tracking-wider text-center pb-1 border-b border-border">
                {roundNames(round, maxRound)}
              </div>
              <div className="flex flex-col gap-3">
                {roundPairings.map((p) => (
                  <PairingCard
                    key={p.id}
                    pairing={p}
                    profiles={profiles}
                    tournamentId={tournamentId}
                    isOwner={isOwner}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
