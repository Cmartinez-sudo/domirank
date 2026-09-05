"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  COUNTRIES,
  COUNT_RULES,
  PRESETS,
  PRESET_ORDER,
  type CountryCode,
  type ModalityCode,
  type PresetId,
} from "@domirank/shared/matches";
import { initialRatingFromAssessment } from "@domirank/shared/rating";
import { saveOnboarding } from "./actions";
import { analytics } from "@/lib/analytics";

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

type Step = "profile" | "q0" | "q1" | "q2" | "q3" | "summary";

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

// Mapeo preset → modality legacy (para dual-write en profiles.default_modality).
const PRESET_TO_LEGACY_MODALITY: Record<PresetId, ModalityCode> = {
  rapido: "ven",
  clasico: "dom",
  doble9: "cub",
  "mesa-completa": "pri",
  personalizado: "custom",
};

function presetFromLegacyModality(m: ModalityCode | null): PresetId | null {
  if (!m) return null;
  if (m === "ven") return "rapido";
  if (m === "dom") return "clasico";
  if (m === "cub") return "clasico"; // Cuba post-retiro d9 → Clásico
  if (m === "pri") return "mesa-completa";
  return "personalizado";
}

export function OnboardingForm({
  initialCountry,
  initialModality,
}: {
  initialCountry: CountryCode | null;
  initialModality: ModalityCode | null;
}) {
  const initialPreset =
    presetFromLegacyModality(initialModality) ??
    (initialCountry
      ? COUNTRIES.find((c) => c.code === initialCountry)?.suggestedPreset ?? null
      : null);

  const [step, setStep] = useState<Step>(initialCountry && initialPreset ? "q0" : "profile");
  const [direction, setDirection] = useState(1);
  const [country, setCountry] = useState<CountryCode | null>(initialCountry);
  const [preset, setPreset] = useState<PresetId | null>(initialPreset);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null, null]);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const suggestedPreset = country
    ? COUNTRIES.find((c) => c.code === country)?.suggestedPreset
    : null;
  const cInfo = country ? COUNTRIES.find((c) => c.code === country) : null;

  function go(next: Step, dir = 1) {
    setDirection(dir);
    setStep(next);
  }

  const totalPoints = answers.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  const { estimatedDisplay } = initialRatingFromAssessment(totalPoints);

  async function submit(skillPoints?: number) {
    if (!country || !preset) return;
    setErr(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("country", country);
      fd.set("preset", preset);
      // Dual-write legacy modality para consumidores viejos.
      fd.set("modality", PRESET_TO_LEGACY_MODALITY[preset]);
      if (skillPoints !== undefined) fd.set("skill_points", String(skillPoints));
      const res = await saveOnboarding(fd);
      if (!res.ok) {
        setErr(res.error);
        setPending(false);
        return;
      }
      const stepsCompleted = skillPoints !== undefined ? QUESTIONS.length : 0;
      analytics.track("user_completed_onboarding", { steps_completed: stepsCompleted });
      window.location.assign(res.next);
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
          {/* ── Step: Perfil (país + modalidad, fusionado) ───────────────── */}
          {step === "profile" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 pt-2">
                <Image
                  src="/branding/logo-vertical-tagline.svg"
                  alt="DomiRank"
                  width={64}
                  height={76}
                  priority
                  className="w-12 h-auto"
                />
                <div>
                  <h1 className="text-2xl font-bold tracking-tight leading-tight">Empecemos</h1>
                  <p className="text-text-dim text-sm">Tu país y tu modalidad favorita.</p>
                </div>
              </div>

              <div className="card">
                <label className="block text-sm font-medium mb-3">¿De qué país eres?</label>
                <div className="grid grid-cols-2 gap-2">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setCountry(c.code); setPreset(c.suggestedPreset); }}
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

              <div className="card space-y-2">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <label className="block text-sm font-medium">¿Cómo prefieres jugar?</label>
                  {cInfo && (
                    <span className="text-text-mute text-xs">Sugerido para {cInfo.name}</span>
                  )}
                </div>
                {PRESET_ORDER.map((id) => {
                  const p = PRESETS[id];
                  const rule = COUNT_RULES[p.countRule];
                  return (
                    <label
                      key={p.id}
                      className={`flex gap-3 items-start p-3 rounded-xl border cursor-pointer transition-colors ${
                        preset === p.id
                          ? "bg-primary/10 border-primary/40"
                          : "bg-surface-2 border-border hover:border-border-strong"
                      } ${!country ? "opacity-60 pointer-events-none" : ""}`}
                    >
                      <input
                        type="radio"
                        name="preset"
                        value={p.id}
                        checked={preset === p.id}
                        onChange={() => setPreset(p.id)}
                        className="mt-1"
                        disabled={!country}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{p.title}</span>
                          {suggestedPreset === p.id && (
                            <span className="badge bg-primary/15 text-primary">Sugerido</span>
                          )}
                        </div>
                        <div className="text-text-mute text-sm mt-0.5">
                          {rule.name} · {p.set === "d9" ? "Doble-9" : "Doble-6"} · {p.target} pts · Capicúa +{p.capicua}
                        </div>
                        {p.noteCountry && (
                          <div className="text-text-dim text-xs italic mt-0.5">{p.noteCountry}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                className="btn-primary w-full"
                disabled={!country || !preset}
                onClick={() => go("q0")}
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ── Steps 3.x: Questions ─────────────────────────────────────── */}
          {isQuestion && (
            <div className="space-y-6">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-text-mute">
                  <span>Paso 2 de 2 — Nivel</span>
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
                  onClick={() => go(qIndex === 0 ? "profile" : (`q${qIndex - 1}`) as Step, -1)}
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
