"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { WizardStepLayout } from "@/components/wizard/WizardStepLayout";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";

export function Step1Form({ userId }: { userId: string }) {
  const router = useRouter();
  const { draft, setField } = useTournamentDraft(userId);
  const [name, setName] = useState(draft.name ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValid = name.trim().length >= 3 && name.trim().length <= 60;

  function handleContinue() {
    if (!isValid) return;
    setField({ name: name.trim(), currentStep: 2 });
    router.push("/tournaments/new/step-2");
  }

  return (
    <WizardStepLayout
      currentStep={1}
      primaryAction={{
        label: "Continuar",
        onClick: handleContinue,
        disabled: !isValid,
      }}
    >
      <div className="max-w-2xl mx-auto w-full px-4 pt-8">
        <h1 className="text-2xl font-bold mb-2">¿Cómo se llama el torneo?</h1>
        <p className="text-text-mute mb-8">
          Usa un nombre que identifique bien el evento.
        </p>

        <label htmlFor="tournament-name" className="sr-only">Nombre del torneo</label>
        <input
          ref={inputRef}
          id="tournament-name"
          type="text"
          className="input text-lg py-4"
          placeholder="Polla del barrio · Mayo 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="off"
          onKeyDown={(e) => e.key === "Enter" && handleContinue()}
          aria-describedby="name-hint"
        />

        <div className="flex justify-between mt-2" id="name-hint" aria-live="polite">
          <p className="text-text-mute text-xs">
            {name.trim().length < 3 ? "Mínimo 3 caracteres" : ""}
          </p>
          <p className={`text-xs ${name.length > 54 ? "text-warning" : "text-text-mute"}`}>
            {name.length}/60
          </p>
        </div>
      </div>
    </WizardStepLayout>
  );
}
