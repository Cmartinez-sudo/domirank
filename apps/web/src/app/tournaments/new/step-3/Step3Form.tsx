"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";
import { createTournament } from "@/lib/tournaments";
import type { CreateTournamentInput } from "@/lib/tournament-schema";
import {
  COUNT_RULES,
  PRESETS,
  countRuleFromLegacyModality,
  type CountRule,
  type PresetId,
} from "@domirank/shared/matches";
import { analytics } from "@/lib/analytics";
import { Avatar } from "@/components/Avatar";

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

const FORMAT_LABELS: Record<string, string> = {
  single_elim: "Eliminación directa",
  round_robin: "Round Robin parejas",
  round_robin_individual: "Round Robin individual",
  swiss: "Suizo",
  continuous_league: "Liga continua",
};

/** Deriva la etiqueta del torneo desde el draft (preset > count_rule > modality legacy). */
function tournamentConfigLabel(draft: {
  count_rule?: CountRule;
  preset?: PresetId;
  modality?: string;
  custom_goal?: number;
}): { title: string; subtitle: string } {
  if (draft.preset && PRESETS[draft.preset]) {
    const p = PRESETS[draft.preset];
    const rule = COUNT_RULES[p.countRule];
    return {
      title: `${rule.name} · ${p.title}`,
      subtitle: `${p.target} pts · Capicúa +${p.capicua}`,
    };
  }
  const rule = draft.count_rule
    ? COUNT_RULES[draft.count_rule]
    : COUNT_RULES[countRuleFromLegacyModality(draft.modality)];
  const target = draft.custom_goal ?? 100;
  return {
    title: `${rule.name} · Personalizado`,
    subtitle: `${target} pts`,
  };
}

/**
 * Step 3 — Resumen + iniciar torneo.
 *
 * Spec F1.4 §Step 3:
 *  - Card con todos los datos del torneo (nombre, formato, jugadores, modalidad, mesas).
 *  - Lista de jugadores (organizer + invitados).
 *  - Links rápidos a step-1 / step-2 para editar.
 *  - CTA grande "Empezar a jugar →" sticky bottom.
 *  - Al tocar CTA: createTournament con status='in_progress' y redirect a /tournaments/[id].
 */
export function Step3Form({ userId, currentUser }: Props) {
  const router = useRouter();
  const { draft, clearDraft } = useTournamentDraft(userId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si el draft está incompleto (deep-link sin pasar por step-1/2), guard.
  const hasMinimumDraft =
    !!draft.name && !!draft.format && !!draft.player_count;

  const formatLabel = draft.format ? FORMAT_LABELS[draft.format] : "—";
  const modalityInfo = tournamentConfigLabel(draft);
  const numBoards = draft.num_boards ?? 1;
  const requiresAttestation = draft.requires_attestation ?? true;
  const rated = draft.rated ?? true;
  const participants = draft.participants_data ?? [];
  const totalPlayers = 1 + participants.length;

  async function handleStart() {
    // Resolver count_rule + modality legacy (dual-write).
    const countRule: CountRule =
      draft.count_rule ??
      (draft.preset ? PRESETS[draft.preset].countRule : null) ??
      countRuleFromLegacyModality(draft.modality ?? null);

    if (
      !hasMinimumDraft ||
      !draft.format ||
      !draft.player_count ||
      !countRule
    ) {
      setError("Faltan datos del torneo. Volvé al step 1.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      const input: CreateTournamentInput = {
        name: draft.name as string,
        format: draft.format,
        count_rule: countRule,
        modality: draft.modality, // opcional, dual-write en server
        // Wizard nuevo usa player_count; el server action lo mapea a max_players.
        player_count: draft.player_count,
        max_players: draft.player_count,
        participant_ids: draft.participant_ids ?? [],
        num_boards: numBoards,
        // Visibility por default 'private' si no vino del step 1.
        visibility: draft.visibility ?? "private",
        requires_attestation: requiresAttestation,
        rated,
        time_limit_minutes: draft.time_limit_minutes ?? null,
        // rounds_count: R para RR Individual (# de ciclos completos), # rondas
        // para Suizo. Sin esto, el server default a null → engine default a R=1.
        rounds_count: draft.rounds_count ?? null,
        custom_goal: draft.custom_goal,
        custom_capicua: draft.custom_capicua,
        // is_open_ended legacy: el wizard nuevo no expone esto; default false.
        is_open_ended: false,
      };

      const result = await createTournament(input);

      if (result.ok) {
        analytics.track("tournament_created", {
          format: input.format,
          count_rule: countRule,
          preset_id: draft.preset ?? "personalizado",
          num_boards: input.num_boards,
          player_count: draft.player_count,
        });
        clearDraft();
        router.push(`/tournaments/${result.tournament_id}`);
        router.refresh();
      } else {
        setError(result.error);
        setPending(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setPending(false);
    }
  }

  if (!hasMinimumDraft) {
    return (
      <WizardStepLayout
        currentStep={3}
        primaryAction={{
          label: "Volver al inicio",
          onClick: () => router.push("/tournaments/new/step-1"),
        }}
      >
        <div className="max-w-2xl mx-auto w-full px-4 pt-12 text-center">
          <h1 className="text-xl font-bold mb-2">Configuración incompleta</h1>
          <p className="text-text-mute">
            Volvé al primer paso para configurar el torneo.
          </p>
        </div>
      </WizardStepLayout>
    );
  }

  return (
    <WizardStepLayout
      currentStep={3}
      primaryAction={{
        label: pending ? "Creando torneo…" : "Empezar a jugar →",
        onClick: handleStart,
        disabled: pending,
        pending,
      }}
      forceSticky
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-6 space-y-4">
        {/* Card resumen */}
        <div className="card p-5 space-y-4">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold mb-1 break-words">{draft.name}</h1>
            <p className="text-text-mute text-sm">
              {formatLabel} · {draft.player_count} jugadores · {modalityInfo.title}
            </p>
            <p className="text-text-mute text-xs">{modalityInfo.subtitle}</p>
            <p className="text-text-mute text-xs mt-1">
              {numBoards} mesa{numBoards !== 1 ? "s" : ""} · Confirmación:{" "}
              {requiresAttestation ? "ON" : "OFF"} · {rated ? "Rated" : "Amistosa"}
              {draft.time_limit_minutes != null && <> · {draft.time_limit_minutes}min/partida</>}
            </p>
          </div>

          {/* Lista de jugadores */}
          <div className="pt-3 border-t border-border/60">
            <h2 className="text-xs font-semibold text-text-mute uppercase tracking-wider mb-2">
              Jugadores ({totalPlayers})
            </h2>
            <div className="space-y-1.5">
              {/* Organizer */}
              <div className="flex items-center gap-3 py-1.5">
                <Avatar player={currentUser} size={28} />
                <span className="text-sm">
                  <span className="font-medium">
                    {currentUser.display_name ?? currentUser.username}
                  </span>
                  <span className="text-text-mute"> (tú)</span>
                </span>
              </div>
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-1.5">
                  <Avatar player={p} size={28} />
                  <span className="text-sm font-medium">
                    {p.display_name ?? p.username}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Edit links */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/tournaments/new/step-1"
            className="btn-ghost text-sm text-center"
          >
            ← Editar configuración
          </Link>
          <Link
            href="/tournaments/new/step-2"
            className="btn-ghost text-sm text-center"
          >
            ← Editar participantes
          </Link>
        </div>

        {error && (
          <div
            className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}
      </div>
    </WizardStepLayout>
  );
}
