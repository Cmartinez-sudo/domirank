"use client";

import { createContext, useContext } from "react";
import type { useTournamentDraft, TournamentDraftUI } from "@/hooks/useTournamentDraft";

type WizardContextValue = {
  draft: TournamentDraftUI;
  setField: (updates: Partial<TournamentDraftUI>) => void;
  clearDraft: () => void;
  userId: string;
};

export const WizardContext = createContext<WizardContextValue | null>(null);

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard debe usarse dentro de WizardProvider");
  return ctx;
}
