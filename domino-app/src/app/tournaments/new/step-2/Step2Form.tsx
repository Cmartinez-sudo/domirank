"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";
import type { SearchedUser } from "@/lib/users";

type MiniUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

type Props = {
  userId: string;
  currentUser: MiniUser;
  friends: MiniUser[];
};

/**
 * Step 2 — Selección de participantes.
 *
 * Spec F1.4 §Step 2:
 *  - Lista de amigos con checkboxes (organizer auto-incluido y disabled).
 *  - Counter "X de Y agregados" donde Y = player_count del Step 1.
 *  - Botón "Continuar" deshabilitado hasta count exacto.
 *  - Search bar filtra la lista en vivo.
 *  - Link "Invitar a no amigo" disabled con mensaje "Próximamente".
 */
export function Step2Form({ userId, currentUser, friends }: Props) {
  const router = useRouter();
  const { draft, setField } = useTournamentDraft(userId);
  const playerCount = draft.player_count ?? 4;

  // Liga continua sin attestation permite agregar no-amigos (F1.10).
  // Si attestation ON o formato no-continuous, solo amigos pueden participar.
  const canAddNonFriends =
    draft.format === "continuous_league" && draft.requires_attestation === false;

  // Selección inicial: lo que haya en draft, o ninguno (organizer no cuenta en participant_ids
  // — se agrega automáticamente al crear el torneo en createTournament).
  const initialSelected = new Set<string>(draft.participant_ids ?? []);
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [query, setQuery] = useState("");

  // No-amigos seleccionados via UserSearch (solo cuando canAddNonFriends).
  // Persistimos sus datos en local state para mostrarlos como chips y
  // pasarlos a participants_data en el draft.
  type ParticipantData = MiniUser;
  const friendsById = useMemo(() => new Map(friends.map((f) => [f.id, f])), [friends]);
  const initialNonFriends: ParticipantData[] = useMemo(() => {
    const prevData = (draft.participants_data ?? []) as ParticipantData[];
    // Filtrar los que no están en la lista de amigos (= no-amigos persistidos)
    return prevData.filter((p) => !friendsById.has(p.id));
  }, [draft.participants_data, friendsById]);
  const [nonFriends, setNonFriends] = useState<ParticipantData[]>(initialNonFriends);

  // Lista filtrada por query (amigos solamente)
  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) => {
      const name = (f.display_name ?? "").toLowerCase();
      const username = f.username.toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [friends, query]);

  // Counter: organizer (1) + amigos seleccionados + no-amigos seleccionados
  const totalAdded = 1 + selected.size + nonFriends.length;
  const isExactCount = totalAdded === playerCount;
  const isOverCount = totalAdded > playerCount;

  function toggleFriend(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Si llegamos al cupo, no permitir agregar más
        if (totalAdded >= playerCount) return prev;
        next.add(id);
      }
      return next;
    });
  }

  function addNonFriend(u: SearchedUser) {
    // No duplicar: chequear que no esté ya como amigo seleccionado ni como no-amigo
    if (selected.has(u.id) || nonFriends.some((nf) => nf.id === u.id) || u.id === userId) {
      return;
    }
    if (totalAdded >= playerCount) return;
    setNonFriends((prev) => [
      ...prev,
      {
        id: u.id,
        username: u.username,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        country: u.country ?? null,
      },
    ]);
  }

  function removeNonFriend(id: string) {
    setNonFriends((prev) => prev.filter((nf) => nf.id !== id));
  }

  function handleContinue() {
    if (!isExactCount) return;
    // Materializar los IDs y data en el draft
    const selectedFriendIds = Array.from(selected);
    const selectedFriendData = friends.filter((f) => selected.has(f.id));
    const allIds = [...selectedFriendIds, ...nonFriends.map((nf) => nf.id)];
    const allData = [...selectedFriendData, ...nonFriends];
    setField({
      participant_ids: allIds,
      participants_data: allData,
      currentStep: 3,
    });
    router.push("/tournaments/new/step-3");
  }

  // Mensaje de cuenta
  let counterText: string;
  let counterClass: string;
  if (isOverCount) {
    counterText = `Demasiados — ${totalAdded} de ${playerCount}`;
    counterClass = "text-danger";
  } else if (isExactCount) {
    counterText = `${totalAdded} de ${playerCount} agregados`;
    counterClass = "text-primary";
  } else {
    counterText = `${totalAdded} de ${playerCount} agregados`;
    counterClass = "text-text-mute";
  }

  return (
    <WizardStepLayout
      currentStep={2}
      primaryAction={{
        label: "Continuar →",
        onClick: handleContinue,
        disabled: !isExactCount,
      }}
      forceSticky
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold mb-1">¿Quiénes juegan?</h1>
          <p className={`text-sm font-medium ${counterClass}`}>{counterText}</p>
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <div className="relative">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-mute pointer-events-none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              className="input pl-10"
              placeholder="Buscar amigos por nombre o @username"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Lista de amigos */}
        <div>
          <h2 className="text-xs font-semibold text-text-mute uppercase tracking-wider mb-2">
            Tus amigos
          </h2>

          {/* Organizer (siempre incluido) */}
          <FriendRow
            friend={currentUser}
            selected
            disabled
            badge="tú · organizador"
            onToggle={() => {}}
          />

          {friends.length === 0 ? (
            <div className="mt-3 p-4 bg-surface-2 border border-border rounded-2xl text-center">
              <p className="text-text-mute text-sm mb-2">
                Aún no tienes amigos agregados.
              </p>
              <Link
                href="/friends"
                className="text-primary text-sm font-medium hover:underline"
              >
                Agregar amigos →
              </Link>
            </div>
          ) : filteredFriends.length === 0 ? (
            <p className="mt-3 text-text-mute text-sm text-center py-4">
              Ningún amigo coincide con &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="mt-1 space-y-1">
              {filteredFriends.map((f) => (
                <FriendRow
                  key={f.id}
                  friend={f}
                  selected={selected.has(f.id)}
                  disabled={!selected.has(f.id) && totalAdded >= playerCount}
                  onToggle={() => toggleFriend(f.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Agregar jugadores que no son amigos.
            - Si canAddNonFriends (liga continua + attestation OFF): UserSearch
              global + chips de seleccionados.
            - Si no: card informativo explicando la restricción. */}
        {canAddNonFriends ? (
          <div className="mt-5">
            <h2 className="text-xs font-semibold text-text-mute uppercase tracking-wider mb-2">
              Otros jugadores de DomiRank
            </h2>
            <p className="text-text-mute text-xs mb-2">
              Esta liga continua no requiere confirmación de partidas, así que puedes invitar a cualquier
              jugador registrado. Ten en cuenta que al cerrar la polla todos los participantes deberán ser
              tus amigos.
            </p>
            <UserSearch
              placeholder="Buscar otros jugadores…"
              excludeIds={[
                userId,
                ...Array.from(selected),
                ...nonFriends.map((nf) => nf.id),
              ]}
              selected={nonFriends.map((nf) => ({
                id: nf.id,
                username: nf.username,
                display_name: nf.display_name,
                avatar_url: nf.avatar_url,
                country: nf.country,
                global_display: null,
                total_games: null,
              }))}
              onSelect={addNonFriend}
              onRemove={removeNonFriend}
              showRating={false}
            />
          </div>
        ) : (
          <div className="mt-5 p-3 bg-surface-2 border border-border rounded-2xl">
            <div className="text-text-mute text-sm flex items-start gap-2">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 mt-0.5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <p className="font-medium">Solo amigos pueden jugar este torneo</p>
                <p className="text-xs mt-0.5">
                  Como las partidas requieren confirmación, los participantes tienen que estar como amigos
                  para poder firmar. Agregá amigos desde{" "}
                  <Link href="/friends" className="text-primary hover:underline">
                    /friends
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </WizardStepLayout>
  );
}

function FriendRow({
  friend,
  selected,
  disabled,
  badge,
  onToggle,
}: {
  friend: MiniUser;
  selected: boolean;
  disabled: boolean;
  badge?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      role="checkbox"
      aria-checked={selected}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        selected
          ? "bg-primary/10 border-primary/40"
          : "bg-surface-2 border-border hover:border-border-strong hover:bg-surface-3"
      } ${disabled && !selected ? "opacity-40 cursor-not-allowed" : ""} ${
        disabled && selected ? "cursor-default" : ""
      }`}
    >
      {/* Checkbox visual */}
      <div
        className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          selected ? "bg-primary border-primary" : "border-border-strong bg-transparent"
        }`}
        aria-hidden="true"
      >
        {selected && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      <Avatar player={friend} size={32} />

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {friend.display_name ?? friend.username}
        </div>
        {badge && <div className="text-text-mute text-xs mt-0.5">{badge}</div>}
        {!badge && (
          <div className="text-text-mute text-xs truncate">@{friend.username}</div>
        )}
      </div>
    </button>
  );
}
