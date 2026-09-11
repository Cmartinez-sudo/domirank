"use client";

// Sprint 1b: Onboarding v2 rediseñado aplicando las 15 reglas.
// State machine: welcome → profile → skill(q0..q3) → avatar → howitworks → celebration
// Barra dinámica: 4 pasos si el usuario ya trajo date_of_birth en signup,
// 5 pasos si es OAuth y llega con date_of_birth=null (Regla 3 skip irrelevantes).

import { useEffect, useMemo, useState } from "react";
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
import {
  saveOnboarding,
  saveOnboardingProgress,
  skipOnboardingGlobal,
} from "./actions";
import { uploadAvatar, removeAvatar } from "@/lib/settings";
import { analytics } from "@/lib/analytics";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";

const QUESTIONS = [
  {
    id: "experience",
    text: "¿Cuánto tiempo llevas jugando {format}?",
    options: [
      { label: "Soy nuevo",            sub: "Menos de 1 año",       pts: 0 },
      { label: "Un par de años",       sub: "1-5 años",             pts: 1 },
      { label: "Llevo años jugando",   sub: "5-15 años",            pts: 2 },
      { label: "Toda la vida",         sub: "Más de 15 años",       pts: 3 },
    ],
  },
  {
    id: "frequency",
    text: "¿Con qué frecuencia juegas {format}?",
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
      { label: "Nunca",                sub: "Solo partidas casuales",       pts: 0 },
      { label: "En familia/casa",      sub: "Torneos informales",           pts: 1 },
      { label: "Torneos locales",      sub: "Barrio o club",                pts: 2 },
      { label: "Torneos regionales",   sub: "Nacionales o internacionales", pts: 3 },
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
  if (m === "cub") return "clasico";
  if (m === "pri") return "mesa-completa";
  return "personalizado";
}

type Step = "welcome" | "profile" | "skill" | "avatar" | "howitworks" | "celebration";

const slideVariants = {
  enter:  (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export function OnboardingFormV2({
  displayName,
  initialCountry,
  initialModality,
  initialDob,
  initialAvatarUrl,
  needsDob,
  initialAnswers,
  initialStep,
  arrivedViaReferral,
  mode = "signup",
}: {
  displayName: string;
  initialCountry: CountryCode | null;
  initialModality: ModalityCode | null;
  initialDob: string | null;
  initialAvatarUrl: string | null;
  needsDob: boolean; // true si date_of_birth IS NULL en profile
  initialAnswers: Record<string, number | string | boolean>;
  initialStep: Step | null;
  arrivedViaReferral: boolean;
  mode?: "signup" | "migration";
}) {
  const isMigration = mode === "migration";
  const startingStep: Step =
    initialStep && ["welcome","profile","skill","avatar","howitworks","celebration"].includes(initialStep)
      ? (initialStep as Step)
      : "welcome";

  // Total pasos visibles (Regla 7): 5 con DOB, 4 sin él.
  const totalSteps = needsDob ? 5 : 4;

  const [step, setStep] = useState<Step>(startingStep);
  const [direction, setDirection] = useState(1);
  const [country, setCountry] = useState<CountryCode | null>(initialCountry);
  const [preset, setPreset] = useState<PresetId | null>(
    presetFromLegacyModality(initialModality),
  );
  const [dob, setDob] = useState<string>(initialDob ?? "");
  const [answers, setAnswers] = useState<(number | null)[]>([
    typeof initialAnswers.q0 === "number" ? initialAnswers.q0 : null,
    typeof initialAnswers.q1 === "number" ? initialAnswers.q1 : null,
    typeof initialAnswers.q2 === "number" ? initialAnswers.q2 : null,
    typeof initialAnswers.q3 === "number" ? initialAnswers.q3 : null,
  ]);
  const [skillSubStep, setSkillSubStep] = useState<0 | 1 | 2 | 3>(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totalPoints = answers.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  const { estimatedDisplay } = initialRatingFromAssessment(totalPoints);
  const formatName = preset ? PRESETS[preset].title : "dominó";

  // Barra: cuál es el índice actual (0..totalSteps-1).
  const stepIndex = useMemo(() => {
    if (step === "welcome") return 0;
    let idx = 0;
    if (step === "profile") idx = 1;
    else if (step === "skill") idx = 2;
    else if (step === "avatar") idx = 3;
    else if (step === "howitworks") idx = 4;
    else if (step === "celebration") idx = totalSteps;
    // Ajuste: si no needsDob, el paso profile ocupa el mismo N pero visible como paso 1/4.
    return idx;
  }, [step, totalSteps]);

  useEffect(() => {
    analytics.track("onboarding_started", {
      version: 2,
      has_dob: !needsDob,
      arrived_via_referral: arrivedViaReferral,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    analytics.track("onboarding_step_viewed", { step, sub_step: step === "skill" ? skillSubStep : null });
    // best-effort: persistir el step en DB (Regla 8).
    saveOnboardingProgress({ step: step === "skill" ? `skill.q${skillSubStep}` : step }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, skillSubStep]);

  // sendBeacon abandono al cerrar tab (Regla 15: distinguir completion vs abandono).
  useEffect(() => {
    function onBeforeUnload() {
      if (step === "celebration") return;
      try {
        const payload = new Blob(
          [JSON.stringify({ step, sub_step: step === "skill" ? skillSubStep : null })],
          { type: "application/json" },
        );
        navigator.sendBeacon?.("/api/analytics/onboarding-abandoned", payload);
      } catch {
        /* no-op */
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [step, skillSubStep]);

  function go(next: Step, dir = 1) {
    setDirection(dir);
    setStep(next);
    setSkillSubStep(0);
  }

  async function handleSkipGlobal() {
    setPending(true);
    analytics.track("onboarding_skipped_global", { step });
    // País por IP-geo desde cliente vía navigator.language como fallback grueso.
    // El server usará "OT" si no lo mandamos.
    const res = await skipOnboardingGlobal({ country: country ?? null });
    if (!res.ok) {
      setErr(res.error);
      setPending(false);
      return;
    }
    window.location.assign(res.next);
  }

  async function handleAnswerSkill(qIndex: number, pts: number) {
    const nextAnswers = [...answers];
    nextAnswers[qIndex] = pts;
    setAnswers(nextAnswers);
    analytics.track("onboarding_step_completed", { step: "skill", sub_step: qIndex, pts });
    await saveOnboardingProgress({
      step: `skill.q${qIndex}`,
      answers: { [`q${qIndex}`]: pts },
    }).catch(() => {});
    setTimeout(() => {
      if (qIndex < 3) {
        setSkillSubStep((qIndex + 1) as 0 | 1 | 2 | 3);
      } else {
        go("avatar");
      }
    }, 220);
  }

  function handleSkipSkill() {
    analytics.track("onboarding_step_skipped", { step: "skill", reason: "user_skipped" });
    go("avatar");
  }

  async function handleCompleteAll() {
    if (!country || !preset) {
      setErr("Faltan datos de perfil.");
      go("profile");
      return;
    }
    setErr(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("country", country);
      fd.set("preset", preset);
      fd.set("modality", PRESET_TO_LEGACY_MODALITY[preset]);
      if (answers.every((a) => a !== null)) {
        fd.set("skill_points", String(totalPoints));
      }
      if (dob) fd.set("date_of_birth", dob);
      if (avatarUrl) fd.set("avatar_url", avatarUrl);
      const res = await saveOnboarding(fd);
      if (!res.ok) {
        setErr(res.error);
        setPending(false);
        return;
      }
      analytics.track("onboarding_completed", {
        steps_completed: answers.filter((a) => a !== null).length,
        arrived_via_referral: arrivedViaReferral,
        initial_skill: totalPoints,
        dob_source: needsDob ? (dob ? "onboarding_v2" : "skipped") : "signup",
        avatar_source: avatarUrl ? "uploaded_or_url" : "none",
        mode,
      });
      if (isMigration) {
        analytics.track("legacy_reonboarding_completed", {});
      }
      window.location.assign(res.next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setPending(false);
    }
  }

  return (
    <div className="overflow-hidden">
      {step !== "welcome" && step !== "celebration" && (
        <ProgressBar
          current={stepIndex}
          total={totalSteps}
          skillSub={step === "skill" ? skillSubStep + 1 : null}
          skillTotal={QUESTIONS.length}
        />
      )}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step === "skill" ? `skill-${skillSubStep}` : step}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {step === "welcome" && (
            <WelcomeStep
              displayName={displayName}
              totalSteps={totalSteps}
              onStart={() => go("profile")}
              onSkipAll={handleSkipGlobal}
              pending={pending}
            />
          )}

          {step === "profile" && (
            <ProfileStep
              country={country}
              preset={preset}
              dob={dob}
              needsDob={needsDob}
              onChangeCountry={(c) => {
                setCountry(c);
                if (!preset) {
                  const suggested = COUNTRIES.find((x) => x.code === c)?.suggestedPreset;
                  if (suggested) setPreset(suggested);
                }
              }}
              onChangePreset={setPreset}
              onChangeDob={setDob}
              onBack={() => go("welcome", -1)}
              onNext={() => {
                analytics.track("onboarding_step_completed", {
                  step: "profile",
                  fields_filled: [country ? "country" : null, preset ? "preset" : null, dob ? "dob" : null].filter(Boolean).length,
                });
                // Migration: saltar skill (ya tienen initial_skill_points).
                go(isMigration ? "avatar" : "skill");
              }}
            />
          )}

          {step === "skill" && (
            <SkillStep
              qIndex={skillSubStep}
              formatName={formatName}
              answers={answers}
              onAnswer={handleAnswerSkill}
              onSkip={handleSkipSkill}
              onBack={() => {
                if (skillSubStep === 0) go("profile", -1);
                else setSkillSubStep((skillSubStep - 1) as 0 | 1 | 2 | 3);
              }}
            />
          )}

          {step === "avatar" && (
            <AvatarStep
              displayName={displayName}
              avatarUrl={avatarUrl}
              onChangeAvatar={setAvatarUrl}
              onNext={() => {
                analytics.track("onboarding_step_completed", {
                  step: "avatar",
                  avatar_source: avatarUrl ? "uploaded_or_url" : "initials",
                });
                // Migration: saltar howitworks (coach marks lo cubren).
                go(isMigration ? "celebration" : "howitworks");
              }}
              onSkip={() => {
                analytics.track("onboarding_step_skipped", { step: "avatar", reason: "user_skipped" });
                go(isMigration ? "celebration" : "howitworks");
              }}
              onBack={() => go(isMigration ? "profile" : "skill", -1)}
            />
          )}

          {step === "howitworks" && (
            <HowItWorksStep
              onNext={() => {
                analytics.track("onboarding_step_completed", { step: "howitworks" });
                go("celebration");
              }}
              onSkip={() => {
                analytics.track("onboarding_step_skipped", { step: "howitworks", reason: "user_skipped" });
                go("celebration");
              }}
              onBack={() => go("avatar", -1)}
            />
          )}

          {step === "celebration" && (
            <CelebrationStep
              displayName={displayName}
              estimatedDisplay={estimatedDisplay}
              hasSkillAnswers={answers.every((a) => a !== null)}
              avatarUrl={avatarUrl}
              onDone={handleCompleteAll}
              pending={pending}
              err={err}
              onBack={() => go("howitworks", -1)}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {err && step !== "celebration" && (
        <div role="alert" className="mt-3 p-2 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
          {err}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ProgressBar({
  current,
  total,
  skillSub,
  skillTotal,
}: {
  current: number;
  total: number;
  skillSub: number | null;
  skillTotal: number;
}) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  return (
    <div className="space-y-1.5 mb-4">
      <div className="flex justify-between text-xs text-text-mute">
        <span>Paso {current} de {total}</span>
        {skillSub != null && <span>Pregunta {skillSub}/{skillTotal}</span>}
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function WelcomeStep({
  displayName,
  totalSteps,
  onStart,
  onSkipAll,
  pending,
}: {
  displayName: string;
  totalSteps: number;
  onStart: () => void;
  onSkipAll: () => void;
  pending: boolean;
}) {
  const items = [
    "Cuéntanos de ti",
    "Tu juego",
    ...(totalSteps === 5 ? ["Tu edad"] : []),
    "Tu foto",
    "Cómo lo hacemos",
  ].slice(0, totalSteps);

  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-3 pt-4">
        <Image
          src="/branding/logo-vertical-tagline.svg"
          alt="DomiRank"
          width={80}
          height={96}
          priority
          className="w-16 h-auto"
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hola, {displayName}</h1>
          <p className="text-text-dim mt-1">60 segundos y listo.</p>
        </div>
      </div>

      <div className="card text-left space-y-2 max-w-sm mx-auto">
        {items.map((label, i) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs flex items-center justify-center font-semibold shrink-0">
              {i + 1}
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 max-w-sm mx-auto">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={onStart}
          disabled={pending}
        >
          Empezar
        </button>
        <button
          type="button"
          className="text-text-mute text-xs hover:text-text"
          onClick={onSkipAll}
          disabled={pending}
        >
          Saltar todo — configuraré después
        </button>
      </div>
    </div>
  );
}

function ProfileStep({
  country,
  preset,
  dob,
  needsDob,
  onChangeCountry,
  onChangePreset,
  onChangeDob,
  onBack,
  onNext,
}: {
  country: CountryCode | null;
  preset: PresetId | null;
  dob: string;
  needsDob: boolean;
  onChangeCountry: (c: CountryCode) => void;
  onChangePreset: (p: PresetId) => void;
  onChangeDob: (d: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const cInfo = country ? COUNTRIES.find((c) => c.code === country) : null;
  const suggestedPreset = cInfo?.suggestedPreset;

  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().slice(0, 10);
  })();

  const dobValid = !needsDob || (dob && new Date(dob) <= new Date(maxDob));
  const canContinue = !!country && !!preset && !!dobValid;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Cuéntanos de ti</h2>
        <p className="text-text-dim text-sm">Personalizamos tu experiencia con esto.</p>
      </div>

      <div className="card">
        <label className="block text-sm font-medium mb-3">¿De qué país eres?</label>
        <p className="text-text-mute text-xs mb-3">Para armar rankings de tu país.</p>
        <div className="grid grid-cols-2 gap-2">
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => onChangeCountry(c.code)}
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
          {cInfo && <span className="text-text-mute text-xs">Sugerido para {cInfo.name}</span>}
        </div>
        <p className="text-text-mute text-xs">Es el default cuando crees una partida. Puedes cambiarlo en cada mesa.</p>
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
                onChange={() => onChangePreset(p.id)}
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
              </div>
            </label>
          );
        })}
      </div>

      {needsDob && (
        <div className="card">
          <label className="block text-sm font-medium mb-1">Tu fecha de nacimiento</label>
          <p className="text-text-mute text-xs mb-3">
            La pedimos solo para confirmar 13+ (requisito legal).
          </p>
          <input
            type="date"
            className="input"
            value={dob}
            onChange={(e) => onChangeDob(e.target.value)}
            max={maxDob}
            required
          />
          {dob && !dobValid && (
            <p className="text-danger text-xs mt-1">Debes tener al menos 13 años.</p>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onBack}>← Atrás</button>
        <button
          type="button"
          className="btn-primary flex-1"
          disabled={!canContinue}
          onClick={onNext}
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}

function SkillStep({
  qIndex,
  formatName,
  answers,
  onAnswer,
  onSkip,
  onBack,
}: {
  qIndex: 0 | 1 | 2 | 3;
  formatName: string;
  answers: (number | null)[];
  onAnswer: (qIndex: number, pts: number) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const q = QUESTIONS[qIndex];
  const text = q.text.replace("{format}", formatName);

  return (
    <div className="space-y-6">
      <div className="text-center pt-2">
        <p className="text-text-mute text-xs mb-1">
          Estimamos tu DomiRank inicial. Cambia con tus primeras 5 partidas atestiguadas.
        </p>
        <h2 className="text-2xl font-bold">{text}</h2>
      </div>

      <div className="space-y-2">
        {q.options.map((opt, oi) => {
          const selected = answers[qIndex] === opt.pts;
          return (
            <button
              key={oi}
              type="button"
              onClick={() => onAnswer(qIndex, opt.pts)}
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
        <button type="button" className="btn-ghost" onClick={onBack}>← Atrás</button>
        <button
          type="button"
          className="btn-ghost flex-1 text-text-mute text-sm"
          onClick={onSkip}
        >
          Saltar y usar principiante
        </button>
      </div>
    </div>
  );
}

function AvatarStep({
  displayName,
  avatarUrl,
  onChangeAvatar,
  onNext,
  onSkip,
  onBack,
}: {
  displayName: string;
  avatarUrl: string | null;
  onChangeAvatar: (url: string | null) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadAvatar(fd);
      if (!r.ok) throw new Error(r.error);
      onChangeAvatar(r.url ?? null);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setUploading(false);
    }
  }

  async function handleClearAvatar() {
    setUploading(true);
    try {
      await removeAvatar();
      onChangeAvatar(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tu foto</h2>
        <p className="text-text-dim text-sm">Cómo te ven en la mesa.</p>
      </div>

      <div className="card flex flex-col items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Tu avatar"
            className="w-24 h-24 rounded-full object-cover"
          />
        ) : (
          <InitialsAvatar name={displayName} size={96} />
        )}

        <div className="flex flex-col items-center gap-2">
          <label className="btn-secondary cursor-pointer">
            {uploading ? "Subiendo…" : avatarUrl ? "Cambiar foto" : "Subir foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
          {avatarUrl && (
            <button
              type="button"
              className="text-text-mute text-xs hover:text-text"
              onClick={handleClearAvatar}
              disabled={uploading}
            >
              Usar mis iniciales
            </button>
          )}
        </div>

        {uploadErr && <p className="text-danger text-xs">{uploadErr}</p>}
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn-ghost" onClick={onBack}>← Atrás</button>
        <button type="button" className="btn-ghost flex-1 text-text-mute text-sm" onClick={onSkip}>
          Saltar
        </button>
        <button type="button" className="btn-primary" onClick={onNext}>
          Continuar →
        </button>
      </div>
    </div>
  );
}

function HowItWorksStep({
  onNext,
  onSkip,
  onBack,
}: {
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cómo funciona</h2>
        <p className="text-text-dim text-sm">3 ideas rápidas antes de tu primera partida.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="card">
          <div className="text-2xl mb-1">📊</div>
          <div className="font-semibold">Tu rating se mueve con cada partida</div>
          <p className="text-text-mute text-sm mt-1">
            Usamos Elo + Margin of Victory. Ganarle a alguien mejor te sube mucho.
          </p>
        </div>
        <div className="card">
          <div className="text-2xl mb-1">✋</div>
          <div className="font-semibold">3 de 4 deben confirmar</div>
          <p className="text-text-mute text-sm mt-1">
            Después de cada partida, la mesa firma el resultado. Sin consenso, no cuenta.
          </p>
        </div>
        <div className="card">
          <div className="text-2xl mb-1">🎯</div>
          <div className="font-semibold">Empiezas Sin Rating</div>
          <p className="text-text-mute text-sm mt-1">
            Tus primeras 5 partidas atestiguadas son calibración. Después apareces en el leaderboard.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn-ghost" onClick={onBack}>← Atrás</button>
        <button type="button" className="btn-ghost flex-1 text-text-mute text-sm" onClick={onSkip}>
          Saltar
        </button>
        <button type="button" className="btn-primary" onClick={onNext}>
          Entendido →
        </button>
      </div>
    </div>
  );
}

function CelebrationStep({
  displayName,
  estimatedDisplay,
  hasSkillAnswers,
  avatarUrl,
  onDone,
  pending,
  err,
  onBack,
}: {
  displayName: string;
  estimatedDisplay: number;
  hasSkillAnswers: boolean;
  avatarUrl: string | null;
  onDone: () => void;
  pending: boolean;
  err: string | null;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6 text-center">
      <div className="pt-6 flex flex-col items-center gap-3">
        <div className="text-5xl">🎯</div>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Tu avatar"
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <InitialsAvatar name={displayName} size={80} />
        )}
        <h1 className="text-3xl font-bold tracking-tight">Listo, {displayName}</h1>
      </div>

      {hasSkillAnswers && (
        <div className="card mx-auto max-w-xs">
          <div className="text-text-mute text-xs uppercase tracking-wider mb-1">Tu DomiRank inicial</div>
          <div className="font-mono font-extrabold text-primary text-5xl">~{estimatedDisplay}.0</div>
          <p className="text-text-mute text-xs mt-2">
            Aparecerás en el leaderboard tras 5 partidas atestiguadas.
          </p>
        </div>
      )}

      {!hasSkillAnswers && (
        <p className="text-text-dim text-sm max-w-xs mx-auto">
          Aparecerás en el leaderboard tras 5 partidas atestiguadas.
          Tu rating inicial se calibra al ir jugando.
        </p>
      )}

      {err && <p className="text-danger text-sm">{err}</p>}

      <div className="space-y-2 pt-2">
        <button className="btn-primary w-full" disabled={pending} onClick={onDone}>
          {pending ? "Guardando…" : "Vamos"}
        </button>
        <button
          type="button"
          className="text-text-mute text-xs hover:text-text"
          onClick={onBack}
          disabled={pending}
        >
          ← Revisar
        </button>
      </div>
    </div>
  );
}
