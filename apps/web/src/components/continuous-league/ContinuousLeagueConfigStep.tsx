"use client";

import { useTournamentDraft } from "@/hooks/useTournamentDraft";

type Props = { userId: string };

export function ContinuousLeagueConfigStep({ userId }: Props) {
  const { draft, setField } = useTournamentDraft(userId);
  const isOpenEnded = draft.is_open_ended ?? false;

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Configuración de la polla</h2>
        <p className="text-text-mute text-sm">¿Tiene fecha de fin?</p>
        <p className="text-text-mute text-sm mt-1">
          Las parejas se forman al armar cada partida.
        </p>
      </div>

      <div className="space-y-2">
        <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors duration-150
          ${isOpenEnded === true
            ? "border-primary bg-primary/10"
            : "border-border hover:border-border-strong"
          }`}>
          <input
            type="radio"
            name="continuous_league_mode"
            checked={isOpenEnded === true}
            onChange={() => setField({ is_open_ended: true })}
            className="mt-1 accent-primary"
          />
          <div>
            <div className="font-semibold">Indefinida</div>
            <div className="text-text-mute text-sm">Jugamos hasta que queramos. Sin fecha de fin.</div>
          </div>
        </label>

        <label className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors duration-150
          ${isOpenEnded === false
            ? "border-primary bg-primary/10"
            : "border-border hover:border-border-strong"
          }`}>
          <input
            type="radio"
            name="continuous_league_mode"
            checked={isOpenEnded === false}
            onChange={() => setField({ is_open_ended: false })}
            className="mt-1 accent-primary"
          />
          <div>
            <div className="font-semibold">Con número fijo de rondas</div>
            <div className="text-text-mute text-sm">
              La polla termina automáticamente al completar las rondas pactadas.
            </div>
          </div>
        </label>
      </div>
    </section>
  );
}
