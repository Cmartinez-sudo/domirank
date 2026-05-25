"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTournamentDraft } from "@/hooks/useTournamentDraft";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type Props = {
  userId: string;
  defaultModality: string;
};

/**
 * Componente client que maneja la entrada al wizard:
 * - Si hay draft guardado → muestra modal "¿Continuar borrador / Empezar de nuevo?"
 * - Si no hay draft → redirige inmediatamente a step-1
 */
export function WizardEntry({ userId, defaultModality }: Props) {
  const router = useRouter();
  const { hasDraft, clearDraft, draft, initialized } = useTournamentDraft(userId);
  const [showModal, setShowModal] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>({ enabled: showModal, onEscape: startFresh });

  useEffect(() => {
    if (!initialized) return;
    if (hasDraft) {
      setShowModal(true);
    } else {
      router.replace("/tournaments/new/step-1");
    }
  }, [initialized, hasDraft, router]);

  function continueWithDraft() {
    const step = draft.currentStep ?? 1;
    router.replace(`/tournaments/new/step-${step}`);
  }

  function startFresh() {
    clearDraft();
    router.replace("/tournaments/new/step-1");
  }

  if (!showModal) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const draftDate = draft.updatedAt
    ? new Date(draft.updatedAt).toLocaleDateString("es", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-entry-title"
    >
      <div
        ref={trapRef}
        className="bg-bg-2 border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 animate-slide-up-fade"
      >
        <div>
          <h2 id="wizard-entry-title" className="text-xl font-bold mb-1">Tienes un borrador guardado</h2>
          {draft.name && (
            <p className="text-text-mute text-sm">
              &ldquo;{draft.name}&rdquo;
            </p>
          )}
          {draftDate && (
            <p className="text-text-mute text-xs mt-0.5">Modificado el {draftDate}</p>
          )}
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={continueWithDraft}
            className="btn-primary w-full"
          >
            Continuar borrador
          </button>
          <button
            type="button"
            onClick={startFresh}
            className="btn-ghost w-full"
          >
            Empezar de nuevo
          </button>
        </div>
      </div>
    </div>
  );
}
