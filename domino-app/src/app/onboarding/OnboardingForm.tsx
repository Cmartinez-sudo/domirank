"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { COUNTRIES, MODALIDADES, type CountryCode, type ModalityCode } from "@/lib/modalidades";
import { initialRatingFromAssessment } from "@/lib/rating";
import { saveOnboarding } from "./actions";

const QUESTIONS = [
  {
    id: "experience",
    text: "¿Cuánto tiempo llevas jugando dominó?",
    options: [
      { label: "Soy nuevo",            sub: "Menos de 1 año",      pts: 0 },
      { label: "Un par de años",        sub: "1-5 años",            pts: 1 },
      { label: "Llevo años jugando",    sub: "5-15 años",           pts: 2 },
      { label: "Toda la vida",          sub: "Más de 15 años",      pts: 3 },
    ],
  },
  {
    id: "frequency",
    text: "¿Con qué frecuencia juegas?",
    options: [
      { label: "Rara vez",             sub: "Esporádico",           pts: 0 },
      { label: "Casual",               sub: "1-2 veces por semana", pts: 1 },
      { label: "Frecuente",            sub: "3+ veces por semana",  pts: 2 },
      { label: "Casi diario",          sub: "Juego todos los días", pts: 3 },
    ],
  },
  {
    id: "competition",
    text: "¿Has competido en torneos?",
    options: [
      { label: "Nunca",                sub: "Solo partidas casuales",        pts: 0 },
      { label: "En familia/casa",      sub: "Torneos informales",            pts: 1 },
      { label: "Torneos locales",      sub: "Barrio o club",                 pts: 2 },
      { label: "Torneos regionales",   sub: "Nacionales o internacionales",  pts: 3 },
    ],
  },
  {
    id: "selfrating",
    text: "¿Cómo te calificarías honestamente?",
    options: [
      { label: "Aún aprendo",          sub: "Sigo las reglas básicas",       pts: 0 },
      { label: "Me defiendo bien",     sub: "Gano a la mayoría casual",      pts: 1 },
      { label: "Suelo ganar",          sub: "Soy competitivo en mi círculo", pts: 2 },
      { label: "Soy de los mejores",   sub: "Nivel experto en mi entorno",   pts: 3 },
    ],
  },
];

type Step = 1 | 2 | "q0" | "q1" | "q2" | "q3" | "summary";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export function OnboardingForm({
  initialCountry,
  initialModality,
}: {
  initialCountry: CountryCode | null;
  initialModality: ModalityCode | null;
}) {
  const [step, setStep] = useState<Step>(initialCountry ? 2 : 1);
  const [direction, setDirection] = useState(1);
  const [country, setCountry] = useState<CountryCode | null>(initialCountry);
  const [modality, setModality] = useState<ModalityCode | null>(
    initialModality ?? (initialCountry ? COUNTRIES.find((c) => c.code === initialCountry)?.suggested ?? null : null)
  );
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null, null]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const suggested = country ? COUNTRIES.find((c) => c.code === country)?.suggested : null;
  const cInfo = country ? COUNTRIES.find((c) => c.code === country) : null;

  function go(next: Step, dir = 1) {
    setDirection(dir);
    setStep(next);
  }

  const totalPoints = answers.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  const { estimatedDisplay } = initialRatingFromAssessment(totalPoints);

  async function submit(skillPoints?: number) {
    if (!country || !modality) return;
    setErr(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("country", country);
      fd.set("modality", modality);
      if (skillPoints !== undefined) fd.set("skill_points", String(skillPoints));
      const res = await saveOnboarding(fd);
      if (res && !res.ok) {
        setErr(res.error);
        setPending(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setPending(false);
    }
  }

  const qIndex = step === "q0" ? 0 : step === "q1" ? 1 : step === "q2" ? 2 : step === "q3" ? 3 : -1;
  const isQuestion = qIndex >= 0;

  // ── Wrappers ──────────────────────────────────────────────────────────────

  return (
    <div className="overflow-hidden">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={String(step)}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* ── Step 1: Country ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center pt-6">
                <div
                  className="inline-grid place-items-center w-16 h-16 rounded-2xl text-white font-extrabold text-2xl mb-3"
                  style={{ background: "linear-gradient(135deg,#10b981,#3b82f6)" }}
                >
                  DR
                </div>
                <h1 className="text-3xl font-bold tracking-tight">¡Bienvenido a DomiRank!</h1>
                <p className="text-text-dim mt-2">Antes de empezar, cuéntanos un poco sobre ti.</p>
              </div>

              <div className="card">
                <label className="block text-sm font-medium mb-3">¿De qué país eres?</label>
                <div className="grid grid-cols-2 gap-2">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setCountry(c.code); setModality(c.suggested); }}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                        country === c.code
                          ? "bg-primary/10 border-primary/40"
                          : "bg-surface-2 border-border hover:border-border-strong"
                      }`}
                    >
                      <span className="text-xl">{c.flag}</span>
                      <span className="text-sm">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button className="btn-primary w-full" disabled={!country} onClick={() => go(2)}>
                Continuar →
              </button>
            </div>
          )}

          {/* ── Step 2: Modality ─────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center pt-4">
                <div className="text-5xl mb-2">{cInfo?.flag ?? "🌎"}</div>
                <h1 className="text-3xl font-bold tracking-tight">¿Qué modalidad juegas?</h1>
                <p className="text-text-dim mt-2">
                  Te sugerimos la más común para {cInfo?.name ?? "tu país"}.
                </p>
              </div>

              <div className="card space-y-2">
                {Object.values(MODALIDADES).map((m) => (
                  <label
                    key={m.code}
                    className={`flex gap-3 items-start p-3 rounded-xl border cursor-pointer transition-colors ${
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
                        <span className="font-semibold">{m.flag} {m.name}</span>
                        {suggested === m.code && (
                          <span className="badge bg-primary/15 text-primary">Sugerido</span>
                        )}
                      </div>
                      <div className="text-text-mute text-sm mt-0.5">{m.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button type="button" className="btn-ghost" onClick={() => go(1, -1)}>← Atrás</button>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={!modality}
                  onClick={() => go("q0")}
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* ── Steps 3.x: Questions ─────────────────────────────────────── */}
          {isQuestion && (
            <div className="space-y-6">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-text-mute">
                  <span>Paso 3 de 3 — Nivel</span>
                  <span>{qIndex + 1} / {QUESTIONS.length}</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-center pt-2">
                <h2 className="text-2xl font-bold">{QUESTIONS[qIndex].text}</h2>
              </div>

              <div className="space-y-2">
                {QUESTIONS[qIndex].options.map((opt, oi) => {
                  const selected = answers[qIndex] === opt.pts;
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => {
                        const next = [...answers];
                        next[qIndex] = opt.pts;
                        setAnswers(next);
                        // Auto-advance after short delay
                        setTimeout(() => {
                          if (qIndex < 3) {
                            go((`q${qIndex + 1}`) as Step);
                          } else {
                            go("summary");
                          }
                        }, 220);
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all active:scale-[.98] ${
                        selected
                          ? "bg-primary/10 border-primary/50"
                          : "bg-surface-2 border-border hover:border-border-strong"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${
                        selected ? "border-primary bg-primary" : "border-border-strong"
                      }`} />
                      <div>
                        <div className={`font-semibold ${selected ? "text-primary" : ""}`}>{opt.label}</div>
                        <div className="text-text-mute text-sm">{opt.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => go(qIndex === 0 ? 2 : (`q${qIndex - 1}`) as Step, -1)}
                >
                  ← Atrás
                </button>
                <button
                  type="button"
                  className="btn-ghost flex-1 text-text-mute text-sm"
                  onClick={() => submit()}
                  disabled={pending}
                >
                  Saltar — empezar como principiante
                </button>
              </div>
            </div>
          )}

          {/* ── Summary ──────────────────────────────────────────────────── */}
          {step === "summary" && (
            <div className="space-y-6 text-center">
              <div className="pt-6">
                <div className="text-6xl mb-4">🎯</div>
                <h1 className="text-3xl font-bold tracking-tight">¡Listo!</h1>
                <p className="text-text-dim mt-2">Tu rating inicial en DomiRank será aproximadamente:</p>
              </div>

              <div
                className="card mx-auto max-w-xs"
                style={{
                  background: "linear-gradient(135deg, rgba(16,185,129,.08), rgba(59,130,246,.05))",
                  borderColor: "rgba(16,185,129,.25)",
                }}
              >
                <div className="text-text-mute text-xs uppercase tracking-wider mb-1">DomiRank estimado</div>
                <div
                  className="font-mono font-extrabold"
                  style={{
                    fontSize: "4rem",
                    lineHeight: 1,
                    backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  ~{estimatedDisplay}.0
                </div>
                <p className="text-text-mute text-xs mt-2">
                  Esto se ajustará rápidamente con tus primeras partidas.
                </p>
              </div>

              <div className="space-y-1 text-sm text-text-dim">
                <div className="flex justify-between px-2">
                  <span>1 — Principiante</span>
                  <span>20 — Leyenda</span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${((estimatedDisplay - 1) / 19) * 100}%`,
                      background: "linear-gradient(90deg,#10b981,#3b82f6)",
                    }}
                  />
                </div>
              </div>

              {err && <p className="text-danger text-sm">{err}</p>}

              <div className="space-y-2 pt-2">
                <button
                  className="btn-primary w-full"
                  disabled={pending}
                  onClick={() => submit(totalPoints)}
                >
                  {pending ? "Guardando…" : "Empezar a jugar"}
                </button>
                <button
                  type="button"
                  className="text-text-mute text-xs hover:text-text"
                  onClick={() => go("q3", -1)}
                  disabled={pending}
                >
                  ← Revisar respuestas
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
