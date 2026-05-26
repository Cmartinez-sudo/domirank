"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import { PlayerSearch } from "@/components/tournament-wizard/PlayerSearch";
import { PairDualSelector } from "@/components/tournament-wizard/PairDualSelector";
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
};

export function Step7Form({ userId, currentUser }: Props) {
  const router = useRouter();
  const { draft, setField } = useTournamentDraft(userId);
  const isPreFormed = draft.inscription_mode === "pre_formed";
  const maxPlayers = draft.max_players ?? 16;

  // Estado para jugadores individuales
  const [individuals, setIndividuals] = useState<MiniUser[]>(
    () => draft.participants_data ?? [currentUser],
  );

  // Estado para parejas
  const [pairs, setPairs] = useState<Array<{ user_a: MiniUser; user_b: MiniUser }>>(
    () => draft.pre_formed_pairs_data ?? [],
  );

  const [showPairSelector, setShowPairSelector] = useState(false);

  // IDs ya usados (no mostrar en búsqueda)
  const usedIds = [
    ...individuals.map((u) => u.id),
    ...pairs.flatMap(({ user_a, user_b }) => [user_a.id, user_b.id]),
  ];

  // Jugadores sin pareja (solo modo pre_formed)
  const pairedIds = new Set(pairs.flatMap(({ user_a, user_b }) => [user_a.id, user_b.id]));
  const unpaired = individuals.filter((u) => !pairedIds.has(u.id));

  // Conteo total de jugadores
  const totalPlayers = isPreFormed
    ? pairs.length * 2 + unpaired.length
    : individuals.length;

  function handleContinue() {
    // Persistir en el draft
    const updates: Parameters<typeof setField>[0] = {
      currentStep: 8,
      participants_data: individuals,
      participant_ids: individuals.map((u) => u.id),
      pre_formed_pairs_data: pairs,
      pre_formed_pairs: pairs.map(({ user_a, user_b }) => ({
        user_a: user_a.id,
        user_b: user_b.id,
      })),
    };
    setField(updates);
    router.push("/tournaments/new/step-8");
  }

  return (
    <WizardStepLayout
      currentStep={7}
      primaryAction={{
        label: `Continuar (${totalPlayers} jugadores)`,
        onClick: handleContinue,
      }}
      hint="Puedes agregar más jugadores después del torneo creado."
      forceSticky
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-8">
        <h1 className="text-2xl font-bold mb-1">¿Quiénes van a participar?</h1>
        <p className="text-text-mute mb-2">
          Puedes agregar más jugadores después también.
        </p>
        <div className="mb-6 text-sm font-medium">
          <span className={totalPlayers > maxPlayers ? "text-danger" : "text-text-dim"}>
            {totalPlayers} de {maxPlayers} jugadores
          </span>
        </div>

        {isPreFormed ? (
          <>
            {/* Parejas formadas */}
            {pairs.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-text-dim mb-2 uppercase tracking-wider">
                  Parejas formadas ({pairs.length})
                </h2>
                <div className="space-y-2">
                  {pairs.map(({ user_a, user_b }, i) => (
                    <div
                      key={`${user_a.id}-${user_b.id}`}
                      className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">
                          {user_a.display_name ?? user_a.username}
                          {" & "}
                          {user_b.display_name ?? user_b.username}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newPairs = pairs.filter((_, idx) => idx !== i);
                          setPairs(newPairs);
                        }}
                        className="text-text-mute hover:text-danger p-1.5 transition-colors"
                        aria-label="Quitar pareja"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individuales sin pareja */}
            {unpaired.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-text-dim mb-2 uppercase tracking-wider">
                  Sin partner ({unpaired.length})
                </h2>
                <PlayerSearch
                  selected={unpaired}
                  excludeIds={usedIds}
                  lockedIds={[currentUser.id]}
                  onAdd={(u: SearchedUser) =>
                    setIndividuals([...individuals, u as MiniUser])
                  }
                  onRemove={(id) => {
                    setIndividuals(individuals.filter((u) => u.id !== id));
                  }}
                />
              </div>
            )}

            {/* Selector de pareja */}
            {showPairSelector ? (
              <div className="p-4 bg-surface-2 border border-border rounded-2xl mb-3">
                <PairDualSelector
                  excludeIds={usedIds}
                  onAdd={(a, b) => {
                    setPairs([...pairs, { user_a: a, user_b: b }]);
                    // Agregar a individuales si no están
                    setIndividuals((prev) => {
                      const ids = new Set(prev.map((u) => u.id));
                      const toAdd: MiniUser[] = [];
                      if (!ids.has(a.id)) toAdd.push(a);
                      if (!ids.has(b.id)) toAdd.push(b);
                      return [...prev, ...toAdd];
                    });
                    setShowPairSelector(false);
                  }}
                  onCancel={() => setShowPairSelector(false)}
                />
              </div>
            ) : (
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setShowPairSelector(true)}
                  className="btn-ghost flex-1 text-sm"
                  disabled={totalPlayers >= maxPlayers}
                >
                  + Agregar pareja completa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // PlayerSearch manejado arriba
                  }}
                  className="btn-ghost flex-1 text-sm"
                  disabled={totalPlayers >= maxPlayers}
                >
                  + Agregar individual
                </button>
              </div>
            )}

            {!showPairSelector && unpaired.length === 0 && pairs.length === 0 && (
              <PlayerSearch
                selected={[]}
                excludeIds={usedIds}
                lockedIds={[currentUser.id]}
                onAdd={(u: SearchedUser) =>
                  setIndividuals([...individuals, u as MiniUser])
                }
                onRemove={(id) =>
                  setIndividuals(individuals.filter((u) => u.id !== id))
                }
                placeholder="Busca jugadores para agregar…"
              />
            )}
          </>
        ) : (
          /* Modo individual_manual */
          <PlayerSearch
            selected={individuals}
            excludeIds={usedIds}
            lockedIds={[currentUser.id]}
            onAdd={(u: SearchedUser) =>
              setIndividuals([...individuals, u as MiniUser])
            }
            onRemove={(id) =>
              setIndividuals(individuals.filter((u) => u.id !== id))
            }
            max={maxPlayers}
            placeholder="Busca por @usuario o nombre…"
          />
        )}
      </div>
    </WizardStepLayout>
  );
}
