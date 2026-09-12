"use client";

// Sprint 1c (S1): modal para re-hacer el skill assessment desde /settings.
// 4 preguntas idénticas al onboarding v2. Al submit, actualiza
// profiles.initial_skill_points y muestra el DomiRank estimado.

import { useState } from "react";
import { recalibrateSkill } from "@/lib/settings";
import { initialRatingFromAssessment } from "@domirank/shared/rating";
import { analytics } from "@/lib/analytics";

const QUESTIONS = [
  {
    id: "experience",
    text: "¿Cuánto tiempo llevas jugando dominó?",
    options: [
      { label: "Soy nuevo",           sub: "Menos de 1 año",       pts: 0 },
      { label: "Un par de años",      sub: "1-5 años",             pts: 1 },
      { label: "Llevo años jugando",  sub: "5-15 años",            pts: 2 },
      { label: "Toda la vida",        sub: "Más de 15 años",       pts: 3 },
    ],
  },
  {
    id: "frequency",
    text: "¿Con qué frecuencia juegas?",
    options: [
      { label: "Rara vez",            sub: "Esporádico",           pts: 0 },
      { label: "Casual",              sub: "1-2 veces por semana", pts: 1 },
      { label: "Frecuente",           sub: "3+ veces por semana",  pts: 2 },
      { label: "Casi diario",         sub: "Juego todos los días", pts: 3 },
    ],
  },
  {
    id: "competition",
    text: "¿Has competido en torneos?",
    options: [
      { label: "Nunca",               sub: "Solo partidas casuales",       pts: 0 },
      { label: "En familia/casa",     sub: "Torneos informales",           pts: 1 },
      { label: "Torneos locales",     sub: "Barrio o club",                pts: 2 },
      { label: "Torneos regionales",  sub: "Nacionales o internacionales", pts: 3 },
    ],
  },
  {
    id: "selfrating",
    text: "¿Cómo te calificarías honestamente?",
    options: [
      { label: "Aún aprendo",         sub: "Sigo las reglas básicas",       pts: 0 },
      { label: "Me defiendo bien",    sub: "Gano a la mayoría casual",      pts: 1 },
      { label: "Suelo ganar",         sub: "Soy competitivo en mi círculo", pts: 2 },
      { label: "Soy de los mejores",  sub: "Nivel experto en mi entorno",   pts: 3 },
    ],
  },
];

export function RecalibrateSkillDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null, null]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ oldPoints: number | null; newPoints: number; estimatedDisplay: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const total = answers.reduce<number>((s, a) => s + (a ?? 0), 0);
  const done = answers.every((a) => a !== null);

  async function handleAnswer(pts: number) {
    const next = [...answers];
    next[qIndex] = pts;
    setAnswers(next);
    setTimeout(() => {
      if (qIndex < 3) setQIndex(qIndex + 1);
    }, 200);
  }

  async function submit() {
    setErr(null);
    setPending(true);
    try {
      const r = await recalibrateSkill({ skill_points: total });
      if (!r.ok) {
        setErr(r.error);
        setPending(false);
        return;
      }
      const { estimatedDisplay } = initialRatingFromAssessment(total);
      analytics.track("skill_recalibrated", {
        delta_skill_points: r.oldPoints != null ? total - r.oldPoints : null,
      });
      setResult({ oldPoints: r.oldPoints, newPoints: total, estimatedDisplay });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setQIndex(0);
    setAnswers([null, null, null, null]);
    setResult(null);
    setErr(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-surface-1 rounded-2xl border border-border max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <div className="space-y-4 text-center">
            <div className="text-4xl">🎯</div>
            <h2 className="text-xl font-bold">DomiRank actualizado</h2>
            <div className="card mx-auto max-w-xs">
              <div className="text-text-mute text-xs uppercase tracking-wider mb-1">Nuevo estimado</div>
              <div className="font-mono font-extrabold text-primary text-5xl">~{result.estimatedDisplay}.0</div>
              {result.oldPoints != null && (
                <p className="text-text-mute text-xs mt-2">
                  Antes: {result.oldPoints} pts · Ahora: {result.newPoints} pts
                </p>
              )}
            </div>
            <p className="text-text-mute text-xs">
              Si ya has jugado partidas, tu Elo real no se sobrescribe — este número aplica solo si estás Sin Rating.
            </p>
            <button className="btn-primary w-full" onClick={onClose}>Listo</button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">Recalibrar mi nivel</h2>
              <button type="button" className="text-text-mute hover:text-text" onClick={onClose}>
                ✕
              </button>
            </div>
            <div className="flex justify-between text-xs text-text-mute">
              <span>Pregunta {qIndex + 1}/4</span>
              <span>{total} pts hasta ahora</span>
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%` }}
              />
            </div>

            <h3 className="text-lg font-bold pt-1">{QUESTIONS[qIndex].text}</h3>

            <div className="space-y-2">
              {QUESTIONS[qIndex].options.map((opt, oi) => {
                const selected = answers[qIndex] === opt.pts;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => handleAnswer(opt.pts)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all active:scale-[.98] ${
                      selected
                        ? "bg-primary/10 border-primary/50"
                        : "bg-surface-2 border-border hover:border-border-strong"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                      selected ? "border-primary bg-primary" : "border-border-strong"
                    }`} />
                    <div>
                      <div className={`text-sm font-semibold ${selected ? "text-primary" : ""}`}>{opt.label}</div>
                      <div className="text-text-mute text-xs">{opt.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setQIndex(Math.max(0, qIndex - 1))}
                disabled={qIndex === 0}
              >
                ← Atrás
              </button>
              {done && qIndex === 3 && (
                <button className="btn-primary flex-1" onClick={submit} disabled={pending}>
                  {pending ? "Guardando…" : "Guardar"}
                </button>
              )}
              {(!done || qIndex < 3) && (
                <button
                  type="button"
                  className="btn-ghost flex-1 text-sm text-text-mute"
                  onClick={() => setQIndex(Math.min(3, qIndex + 1))}
                >
                  Saltar pregunta →
                </button>
              )}
            </div>

            {err && <p className="text-danger text-sm">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}
