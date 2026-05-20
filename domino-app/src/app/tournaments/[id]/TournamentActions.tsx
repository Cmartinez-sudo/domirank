"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateInitialPairings, generateNextRound } from "@/lib/tournament-formats-engine";

export function GeneratePairingsButton({ tournamentId }: { tournamentId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function handle() {
    setBusy(true);
    setErr(null);
    const res = await generateInitialPairings(tournamentId);
    if (res.ok) {
      router.refresh();
    } else {
      setErr(res.error);
    }
    setBusy(false);
  }

  return (
    <div>
      <button className="btn-primary text-sm" onClick={handle} disabled={busy}>
        {busy ? "Generando…" : "Generar pareos iniciales"}
      </button>
      {err && <p className="text-danger text-xs mt-1">{err}</p>}
    </div>
  );
}

export function GenerateNextRoundButton({ tournamentId }: { tournamentId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function handle() {
    setBusy(true);
    setErr(null);
    const res = await generateNextRound(tournamentId);
    if (res.ok) {
      router.refresh();
    } else {
      setErr(res.error);
    }
    setBusy(false);
  }

  return (
    <div>
      <button className="btn-ghost text-sm" onClick={handle} disabled={busy}>
        {busy ? "Generando…" : "Siguiente ronda →"}
      </button>
      {err && <p className="text-danger text-xs mt-1">{err}</p>}
    </div>
  );
}
