"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { PairDualSelector } from "@/components/tournament-wizard/PairDualSelector";
import { PlayerSearch } from "@/components/tournament-wizard/PlayerSearch";
import {
  addPlayerToTournament,
  addPairToTournament,
  removeFromTournament,
  invitePartner,
} from "@/lib/tournament-pairs-actions";
import { startTournament, setTournamentStatus } from "@/lib/tournaments";
import { FinalizeTournamentDialog } from "@/components/FinalizeTournamentDialog";
import type { SearchedUser } from "@/lib/users";
import type { InscriptionMode } from "@/types/continuous-league";

type MiniUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

type Pair = {
  id: number | string;
  user_a_id: string;
  user_b_id: string;
};

type Invite = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  profiles?: MiniUser | null;
};

type Tournament = {
  id: string;
  name: string;
  status: string;
  created_by: string;
  inscription_mode: InscriptionMode;
  max_players: number;
  format: string;
  modality: string;
};

type Props = {
  tournament: Tournament;
  players: MiniUser[];
  pairs: Pair[];
  invites: Invite[];
  userId: string;
};

export function ManagePageClient({ tournament, players, pairs, invites, userId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAddPair, setShowAddPair] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<string | null>(null);
  const [showFinalize, setShowFinalize] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isContinuousLeague = tournament.inscription_mode === "continuous_league";
  const isPreFormed = tournament.inscription_mode === "pre_formed";
  const isManual = tournament.inscription_mode === "individual_manual";
  const isOpen = tournament.status === "open";

  const pairedIds = new Set(pairs.flatMap((p) => [p.user_a_id, p.user_b_id]));
  const unpairedPlayers = players.filter((p) => !pairedIds.has(p.id));
  const allIds = players.map((p) => p.id);

  // Mapa de invites pendientes por inviter
  const inviteByInviter: Record<string, Invite> = {};
  for (const inv of invites) inviteByInviter[inv.inviter_id] = inv;

  function getPlayer(id: string): MiniUser | undefined {
    return players.find((p) => p.id === id);
  }

  // Verificar si se puede iniciar el torneo
  const expectedPairs = Math.floor(players.length / 2);
  const canStart = isOpen && (
    isContinuousLeague
      ? players.length === tournament.max_players
      : pairs.length >= expectedPairs && unpairedPlayers.length === 0
  );

  function notify(message: string) {
    setMsg(message);
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleRemove(uid: string) {
    setErr(null);
    startTransition(async () => {
      const r = await removeFromTournament(tournament.id, uid);
      if (!r.ok) setErr(r.error);
      else { router.refresh(); notify("Jugador removido."); }
    });
  }

  async function handleAddPlayer(u: SearchedUser) {
    setErr(null);
    startTransition(async () => {
      const r = await addPlayerToTournament(tournament.id, u.id);
      if (!r.ok) setErr(r.error);
      else { router.refresh(); setShowAddPlayer(false); notify("Jugador agregado."); }
    });
  }

  async function handleAddPair(a: MiniUser, b: MiniUser) {
    setErr(null);
    startTransition(async () => {
      const r = await addPairToTournament(tournament.id, a.id, b.id);
      if (!r.ok) setErr(r.error);
      else { router.refresh(); setShowAddPair(false); notify("Pareja agregada."); }
    });
  }

  async function handleInvitePartner(inviterId: string, inviteeId: string) {
    setErr(null);
    startTransition(async () => {
      const r = await invitePartner(tournament.id, inviteeId);
      if (!r.ok) setErr(r.error);
      else { router.refresh(); setInviteTarget(null); notify("Invitación enviada."); }
    });
  }

  async function handleStart() {
    setErr(null);
    startTransition(async () => {
      const r = await startTournament(tournament.id);
      if (!r.ok) setErr(r.error);
      else { router.push(`/tournaments/${tournament.id}`); router.refresh(); }
    });
  }

  async function handleFinalize() {
    setErr(null);
    startTransition(async () => {
      const r = await setTournamentStatus(tournament.id, "finished");
      if (!r.ok) setErr(r.error ?? "No se pudo finalizar el torneo");
      else { setShowFinalize(false); router.push(`/tournaments/${tournament.id}`); router.refresh(); }
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/tournaments/${tournament.id}`}
          aria-label="Volver al torneo"
          className="text-text-mute hover:text-text transition-colors -m-1 p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{tournament.name}</h1>
          <p className="text-text-mute text-sm">Gestión de inscritos</p>
        </div>
      </div>

      {/* Feedback */}
      <div aria-live="polite">
        {msg && (
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl text-primary text-sm">
            {msg}
          </div>
        )}
        {err && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm" role="alert">
            {err}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-text-mute text-sm">Inscritos</p>
          <p className="text-2xl font-bold">{players.length} <span className="text-text-mute text-base font-normal">/ {tournament.max_players}</span></p>
        </div>
        {isPreFormed && !isContinuousLeague && (
          <div className="text-right">
            <p className="text-text-mute text-sm">Parejas</p>
            <p className="text-2xl font-bold">{pairs.length}</p>
          </div>
        )}
      </div>

      {/* Parejas formadas */}
      {isPreFormed && !isContinuousLeague && pairs.length > 0 && (
        <section className="card p-0 overflow-hidden">
          <h2 className="px-4 py-3 border-b border-border font-semibold text-sm">Parejas formadas</h2>
          <div className="divide-y divide-border/50">
            {pairs.map((pair) => {
              const pA = getPlayer(pair.user_a_id);
              const pB = getPlayer(pair.user_b_id);
              return (
                <div key={pair.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {pA && <Avatar player={pA} size={28} />}
                    <span className="text-sm truncate">{pA?.display_name ?? pA?.username ?? "?"}</span>
                    <span className="text-text-mute text-sm mx-1">&amp;</span>
                    {pB && <Avatar player={pB} size={28} />}
                    <span className="text-sm truncate">{pB?.display_name ?? pB?.username ?? "?"}</span>
                  </div>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        if (pA) handleRemove(pA.id);
                      }}
                      disabled={isPending}
                      aria-label={`Remover pareja de ${pA?.display_name ?? pA?.username ?? "?"}`}
                      className="text-text-mute hover:text-danger text-xs px-2 py-1.5 rounded-lg hover:bg-danger/10 transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      remover
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Jugadores sin pareja */}
      {isPreFormed && !isContinuousLeague && unpairedPlayers.length > 0 && (
        <section className="card p-0 overflow-hidden">
          <h2 className="px-4 py-3 border-b border-border font-semibold text-sm">Sin partner</h2>
          <div className="divide-y divide-border/50">
            {unpairedPlayers.map((p) => {
              const pending_invite = inviteByInviter[p.id];
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar player={p} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.display_name ?? p.username}</div>
                    {pending_invite ? (
                      <div className="text-text-mute text-xs mt-0.5">
                        invitó a {(pending_invite.profiles as any)?.display_name ?? (pending_invite.profiles as any)?.username ?? "alguien"} &middot; pendiente
                      </div>
                    ) : (
                      <div className="text-text-mute text-xs mt-0.5">sin partner</div>
                    )}
                  </div>
                  {isOpen && !pending_invite && p.id !== userId && (
                    <button
                      type="button"
                      onClick={() => setInviteTarget(p.id)}
                      aria-label={`Invitar partner para ${p.display_name ?? p.username}`}
                      className="text-primary text-xs hover:underline px-2 py-1.5 rounded-lg min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      invitar partner
                    </button>
                  )}
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => handleRemove(p.id)}
                      disabled={isPending}
                      aria-label={`Quitar a ${p.display_name ?? p.username} del torneo`}
                      className="text-text-mute hover:text-danger text-xs px-2 py-1.5 rounded-lg hover:bg-danger/10 transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      quitar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Modo individual_manual: lista de todos los jugadores */}
      {isManual && players.length > 0 && (
        <section className="card p-0 overflow-hidden">
          <h2 className="px-4 py-3 border-b border-border font-semibold text-sm">
            Jugadores inscritos ({players.length})
          </h2>
          <div className="divide-y divide-border/50">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar player={p} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.display_name ?? p.username}</div>
                </div>
                {isOpen && p.id !== userId && (
                  <button
                    type="button"
                    onClick={() => handleRemove(p.id)}
                    disabled={isPending}
                    aria-label={`Quitar a ${p.display_name ?? p.username} del torneo`}
                    className="text-text-mute hover:text-danger text-xs px-2 py-1.5 rounded-lg hover:bg-danger/10 transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    quitar
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Invite partner modal */}
      {inviteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-partner-title"
          onClick={(e) => { if (e.target === e.currentTarget) setInviteTarget(null); }}
        >
          <div
            className="bg-bg-2 border border-border rounded-2xl p-5 max-w-sm w-full space-y-4 animate-slide-up-fade"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <h3 id="invite-partner-title" className="font-bold text-lg">
              Invitar partner para {getPlayer(inviteTarget)?.display_name ?? "?"}
            </h3>
            <PlayerSearch
              selected={[]}
              excludeIds={allIds}
              onAdd={(u: SearchedUser) => handleInvitePartner(inviteTarget, u.id)}
              onRemove={() => {}}
              placeholder="Busca el partner a invitar…"
            />
            <button type="button" onClick={() => setInviteTarget(null)} className="btn-ghost w-full">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Acciones para agregar */}
      {isOpen && !isContinuousLeague && !showAddPair && !showAddPlayer && (
        <div className="flex gap-2 flex-wrap">
          {isPreFormed && (
            <button
              type="button"
              onClick={() => setShowAddPair(true)}
              className="btn-ghost text-sm flex-1"
              disabled={players.length >= tournament.max_players}
            >
              + Agregar pareja completa
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddPlayer(true)}
            className="btn-ghost text-sm flex-1"
            disabled={players.length >= tournament.max_players}
          >
            + Agregar individual
          </button>
        </div>
      )}

      {showAddPair && (
        <div className="card">
          <PairDualSelector
            excludeIds={allIds}
            onAdd={handleAddPair}
            onCancel={() => setShowAddPair(false)}
          />
        </div>
      )}

      {showAddPlayer && (
        <div className="card">
          <h3 className="font-semibold mb-3">Agregar jugador individual</h3>
          <PlayerSearch
            selected={[]}
            excludeIds={allIds}
            onAdd={handleAddPlayer}
            onRemove={() => {}}
            placeholder="Busca por @usuario o nombre…"
          />
          <button type="button" onClick={() => setShowAddPlayer(false)} className="btn-ghost w-full mt-3 text-sm">
            Cancelar
          </button>
        </div>
      )}

      {/* Asignación de parejas manual (individual_manual) */}
      {isManual && isOpen && players.length >= 4 && (
        <Link
          href={`/tournaments/${tournament.id}/manage/pair`}
          className="btn-ghost w-full text-center block"
        >
          Asignar parejas manualmente →
        </Link>
      )}

      {/* Polla: roster de inscritos */}
      {isContinuousLeague && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Jugadores inscritos</h2>
          <div className="divide-y divide-border">
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2">
                  <Avatar player={p} size={28} />
                  <span className="font-medium">{p.display_name ?? p.username}</span>
                </span>
                {isOpen && p.id !== tournament.created_by && (
                  <button
                    type="button"
                    // TODO: handler removeFromTournament — funcionalidad pendiente.
                    disabled
                    title="Quitar jugador: funcionalidad pendiente"
                    className="text-text-mute text-sm opacity-50 cursor-not-allowed"
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>
          {players.length < tournament.max_players && isOpen && (
            <button
              type="button"
              // TODO: handler openAddPlayerModal — funcionalidad pendiente.
              disabled
              title="Agregar jugador: funcionalidad pendiente"
              className="btn-secondary w-full opacity-50 cursor-not-allowed"
            >
              + Agregar jugador
            </button>
          )}
        </section>
      )}

      {/* Botón iniciar torneo */}
      {isOpen && (
        <div className="card space-y-3">
          <div>
            <h2 className="font-semibold">Iniciar torneo</h2>
            <p className="text-text-mute text-sm mt-0.5">
              {canStart
                ? isContinuousLeague
                  ? "Todo listo. El torneo está completo."
                  : "Todo listo. Todos los jugadores tienen pareja."
                : isContinuousLeague
                ? `Faltan ${tournament.max_players - players.length} jugadores.`
                : isPreFormed
                ? `Faltan parejas: ${unpairedPlayers.length} jugadores sin partner.`
                : `Asigná todas las parejas primero.`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart || isPending}
            aria-busy={isPending}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                Iniciando…
              </span>
            ) : "Iniciar torneo"}
          </button>
        </div>
      )}

      {/* Acciones destructivas del organizador */}
      {(tournament.status === "open" || tournament.status === "in_progress") && (
        <div className="card space-y-3">
          <div>
            <h2 className="font-semibold">Acciones del organizador</h2>
            <p className="text-text-mute text-sm mt-0.5">
              Finalizar cierra el torneo inmediatamente. No se generan más rondas.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFinalize(true)}
            disabled={isPending}
            className="btn-ghost w-full text-danger hover:bg-danger/10 border-danger/30"
          >
            Finalizar torneo
          </button>
        </div>
      )}

      <FinalizeTournamentDialog
        open={showFinalize}
        tournamentName={tournament.name}
        pending={isPending}
        onConfirm={handleFinalize}
        onCancel={() => setShowFinalize(false)}
      />
    </div>
  );
}
