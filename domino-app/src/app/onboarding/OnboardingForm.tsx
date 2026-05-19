"use client";

import { useState } from "react";
import { COUNTRIES, MODALIDADES, type CountryCode, type ModalityCode } from "@/lib/modalidades";
import { saveOnboarding } from "./actions";

export function OnboardingForm({
  initialCountry,
  initialModality,
}: {
  initialCountry: CountryCode | null;
  initialModality: ModalityCode | null;
}) {
  const [step, setStep] = useState<1 | 2>(initialCountry ? 2 : 1);
  const [country, setCountry] = useState<CountryCode | null>(initialCountry);
  const suggested = country ? COUNTRIES.find((c) => c.code === country)?.suggested : null;
  const [modality, setModality] = useState<ModalityCode | null>(initialModality ?? suggested ?? null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (step === 1) {
    return (
      <div className="space-y-6">
        <div className="text-center pt-6">
          <div
            className="inline-grid place-items-center w-16 h-16 rounded-2xl text-white font-extrabold text-2xl mb-3"
            style={{ background: "linear-gradient(135deg,#10b981,#3b82f6)" }}
          >
            DR
          </div>
          <h1 className="text-3xl font-bold tracking-tight">¡Bienvenido a DomiRank!</h1>
          <p className="text-text-dim mt-2">
            Antes de empezar, cuéntanos un poco sobre cómo juegas.
            Esto nos ayuda a usar la modalidad correcta por defecto cuando crees partidas.
          </p>
        </div>

        <div className="card">
          <label className="block text-sm font-medium mb-3">¿De qué país eres?</label>
          <div className="grid grid-cols-2 gap-2">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCountry(c.code);
                  setModality(c.suggested);
                }}
                className={`flex items-center gap-3 p-3 rounded-md border transition-colors text-left ${
                  country === c.code
                    ? "bg-primary/10 border-primary/40"
                    : "bg-surface-2 border-border hover:border-border-strong"
                }`}
              >
                <span className="text-xl">{c.flag}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn-primary w-full"
          disabled={!country}
          onClick={() => setStep(2)}
        >
          Continuar →
        </button>
      </div>
    );
  }

  const cInfo = country ? COUNTRIES.find((c) => c.code === country) : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!country || !modality) return;
    setErr(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("country", country);
      fd.set("modality", modality);
      const res = await saveOnboarding(fd);
      if (res && !res.ok) {
        setErr(res.error);
        setPending(false);
      }
      // Si es ok, saveOnboarding hace redirect a /dashboard
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Error");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="text-center pt-4">
        <div className="text-5xl mb-2">{cInfo?.flag ?? "🌎"}</div>
        <h1 className="text-3xl font-bold tracking-tight">¿Qué modalidad juegas?</h1>
        <p className="text-text-dim mt-2">
          Te sugerimos la más común para {cInfo?.name ?? "tu país"}, pero puedes elegir cualquiera.
          Después puedes cambiar al crear cada partida.
        </p>
      </div>

      <div className="card space-y-2">
        {Object.values(MODALIDADES).map((m) => {
          const isSuggested = cInfo?.suggested === m.code;
          return (
            <label
              key={m.code}
              className={`flex gap-3 items-start p-3 rounded-md border cursor-pointer transition-colors ${
                modality === m.code
                  ? "bg-primary/10 border-primary/40"
                  : "bg-surface-2 border-border hover:border-border-strong"
              }`}
            >
              <input
                type="radio"
                name="modality"
                value={m.code}
                checked={modality === m.code}
                onChange={() => setModality(m.code)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">
                    {m.flag} {m.name}
                  </span>
                  {isSuggested && (
                    <span className="badge bg-primary/15 text-primary">Sugerido para tu país</span>
                  )}
                </div>
                <div className="text-text-mute text-sm mt-1">{m.desc}</div>
              </div>
            </label>
          );
        })}
      </div>

      {err && <p className="text-danger text-sm">{err}</p>}

      <div className="flex gap-3">
        <button type="button" className="btn-ghost" onClick={() => setStep(1)} disabled={pending}>
          ← Atrás
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={!modality || pending}>
          {pending ? "Guardando…" : "Empezar a jugar"}
        </button>
      </div>
    </form>
  );
}
