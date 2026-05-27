"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";
import { createTournament } from "@/lib/tournaments";
import type { CreateTournamentInput } from "@/lib/tournament-schema";
import { analytics } from "@/lib/analytics";

const FORMAT_LABELS: Record<string, string> = {
  single_elim: "Eliminación directa",
  round_robin: "Todos contra todos",
  swiss: "Sistema suizo",
  polla: "Polla (liga continua)",
};

const MODALITY_LABELS: Record<string, string> = {
  ven: "Venezolano",
  dom: "Dominicano",
  cub: "Cubano",
  pri: "Puertorriqueño",
  custom: "Personalizado",
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Pública",
  private: "Privada",
  code: "Por código",
};

const MODE_LABELS: Record<string, string> = {
  pre_formed: "Parejas pre-formadas",
  individual_manual: "Individual + tú asignas",
};

type SummaryRow = {
  label: string;
  value: string;
  step: number;
};

export function Step9Form({ userId }: { userId: string }) {
  const router = useRouter();
  const { draft, setField, clearDraft } = useTournamentDraft(userId);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rated = draft.rated ?? true;

  const totalPlayers =
    (draft.pre_formed_pairs?.length ?? 0) * 2 +
    (draft.participant_ids?.filter(
      (id) =>
        !(draft.pre_formed_pairs ?? []).some(
          ({ user_a, user_b }) => user_a === id || user_b === id,
        ),
    ).length ?? 0);

  const summaryRows: SummaryRow[] = [
    { label: "Nombre", value: draft.name ?? "—", step: 1 },
    { label: "Visibilidad", value: VISIBILITY_LABELS[draft.visibility ?? "private"] ?? "—", step: 2 },
    { label: "Formato", value: FORMAT_LABELS[draft.format ?? ""] ?? "—", step: 3 },
    {
      label: "Modalidad",
      value:
        draft.modality === "custom"
          ? `Personalizado · meta ${draft.custom_goal ?? 100} · capicúa +${draft.custom_capicua ?? 30}`
          : (MODALITY_LABELS[draft.modality ?? ""] ?? "—"),
      step: 4,
    },
    {
      label: "Jugadores",
      value: `${draft.max_players ?? "—"} (cupo máximo)`,
      step: 5,
    },
    {
      label: "Inscripción",
      value: MODE_LABELS[draft.inscription_mode ?? "pre_formed"] ?? "—",
      step: 6,
    },
    ...(draft.format === "polla"
      ? [{
          label: "Modo",
          value: (draft.is_open_ended ?? false) ? "Indefinida" : "Con número fijo de rondas",
          step: 6,
        }]
      : []),
    {
      label: "Participantes pre-cargados",
      value: `${totalPlayers} jugadores${(draft.pre_formed_pairs?.length ?? 0) > 0 ? ` · ${draft.pre_formed_pairs?.length} parejas` : ""}`,
      step: 7,
    },
    // Step 8 fields (Duración + Mesas) son irrelevantes para polla — las
    // partidas siempre van "hasta la meta" y no hay configuración de mesas.
    ...(draft.format !== "polla"
      ? [
          {
            label: "Duración de partida",
            value:
              draft.time_limit_minutes != null
                ? `${draft.time_limit_minutes} minutos por partida`
                : "Hasta la meta de puntos",
            step: 8,
          },
          {
            label: "Mesas",
            value: `${draft.num_boards ?? 1} mesa${(draft.num_boards ?? 1) !== 1 ? "s" : ""}`,
            step: 8,
          },
        ]
      : []),
  ];

  async function handleCreate() {
    setError(null);
    setPending(true);

    try {
      // Construir el input para createTournament
      const input: CreateTournamentInput = {
        name: draft.name ?? "",
        visibility: draft.visibility ?? "private",
        format: draft.format ?? "swiss",
        modality: draft.modality ?? "ven",
        max_players: draft.max_players ?? 8,
        inscription_mode: draft.inscription_mode ?? "pre_formed",
        time_limit_minutes: draft.time_limit_minutes ?? null,
        num_boards: draft.num_boards ?? 1,
        description: draft.description,
        custom_goal: draft.custom_goal,
        custom_capicua: draft.custom_capicua,
        participant_ids: draft.participant_ids ?? [],
        pre_formed_pairs: draft.pre_formed_pairs ?? [],
        rated,
        is_open_ended: draft.is_open_ended ?? false,
      };

      const result = await createTournament(input);

      if (result.ok) {
        analytics.track("tournament_created", {
          format: input.format,
          modality: input.modality,
          num_boards: input.num_boards,
        });
        clearDraft();
        router.push(`/tournaments/${result.tournament_id}/manage`);
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

  // Polla saltó step 8 desde step 7 — el back nav default iría a step 8
  // que el user nunca vio. Override para volver a step 7.
  const backToPrev = () => {
    const prevStep = draft.format === "polla" ? 7 : 8;
    router.push(`/tournaments/new/step-${prevStep}`);
  };

  return (
    <WizardStepLayout
      currentStep={9}
      primaryAction={{
        label: pending ? "Creando torneo…" : "Crear torneo →",
        onClick: handleCreate,
        disabled: pending,
        pending,
      }}
      forceSticky
      onBack={backToPrev}
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-8">
        <h1 className="text-2xl font-bold mb-2">Todo listo. Revisa antes de crear.</h1>
        <p className="text-text-mute mb-8">
          Toca cualquier fila para volver y editar ese paso.
        </p>

        <div className="card p-0 overflow-hidden divide-y divide-border/60">
          {summaryRows.map((row) => (
            <Link
              key={row.step}
              href={`/tournaments/new/step-${row.step}`}
              className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-text-mute text-xs font-medium uppercase tracking-wide">
                  {row.label}
                </div>
                <div className="text-text font-semibold mt-0.5 truncate">{row.value}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-text-mute shrink-0">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>

        <label className="card mt-4 flex items-start gap-3 cursor-pointer hover:border-border-strong transition-colors">
          <input
            type="checkbox"
            checked={rated}
            onChange={(e) => setField({ rated: e.target.checked })}
            className="accent-primary mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Cuenta para el ranking global</div>
            <div className="text-text-mute text-sm mt-1">
              {rated
                ? "Las partidas de este torneo afectan el Elo de los participantes."
                : "Torneo amistoso: las partidas no modifican el ranking de nadie."}
            </div>
          </div>
        </label>

        {error && (
          <div
            className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm"
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
