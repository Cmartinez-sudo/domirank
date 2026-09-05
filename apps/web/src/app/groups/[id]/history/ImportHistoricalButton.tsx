"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importHistoricalMatches } from "@/lib/groups-attribution";

export function ImportHistoricalButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const r = await importHistoricalMatches({ groupId });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.data) {
        const { scanned, imported, skipped } = r.data;
        if (scanned === 0) {
          setFeedback("No se encontraron partidas para importar.");
        } else {
          setFeedback(
            `Escaneadas ${scanned}: ${imported} importada${imported === 1 ? "" : "s"}, ${skipped} ya existía${skipped === 1 ? "" : "n"}.`,
          );
        }
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="btn-secondary !min-h-0 !py-2 !px-3 text-sm disabled:opacity-50"
      >
        {pending ? "Importando…" : "Importar historial"}
      </button>
      {feedback && (
        <span className="text-text-mute text-xs">{feedback}</span>
      )}
      {error && (
        <span className="text-danger text-xs">{error}</span>
      )}
    </div>
  );
}
