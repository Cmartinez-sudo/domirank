'use client';

import { useState, useTransition } from 'react';
import { createTournament } from '@/lib/club-pro/tournament-actions';

type Pair = {
  playerAName: string;
  playerAEmail: string;
  playerBName: string;
  playerBEmail: string;
};

type FormState = {
  name: string;
  description: string;
  prizeDescription: string;
  scheduledStartAt: string;
  roundsCount: number;
  roundDurationMinutes: number;
  targetPoints: number;
  pairs: Pair[];
};

const EMPTY_PAIR: Pair = {
  playerAName: '',
  playerAEmail: '',
  playerBName: '',
  playerBEmail: '',
};

const INITIAL_STATE: FormState = {
  name: '',
  description: '',
  prizeDescription: '',
  scheduledStartAt: '',
  roundsCount: 5,
  roundDurationMinutes: 30,
  targetPoints: 200,
  pairs: [
    { ...EMPTY_PAIR },
    { ...EMPTY_PAIR },
    { ...EMPTY_PAIR },
    { ...EMPTY_PAIR },
  ],
};

const STEPS = [
  { id: 1, title: 'Info básica' },
  { id: 2, title: 'Configuración Swiss' },
  { id: 3, title: 'Parejas' },
  { id: 4, title: 'Revisar y crear' },
] as const;

export function CreateTournamentWizard({ orgSlug, orgName }: { orgSlug: string; orgName: string }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
  };

  const updatePair = (index: number, key: keyof Pair, value: string) => {
    setForm((s) => {
      const next = [...s.pairs];
      next[index] = { ...next[index], [key]: value };
      return { ...s, pairs: next };
    });
  };

  const addPair = () => {
    setForm((s) => ({ ...s, pairs: [...s.pairs, { ...EMPTY_PAIR }] }));
  };

  const removePair = (index: number) => {
    setForm((s) => ({ ...s, pairs: s.pairs.filter((_, i) => i !== index) }));
  };

  const canAdvance = (() => {
    if (step === 1) {
      return form.name.trim().length >= 3 && form.scheduledStartAt.length > 0;
    }
    if (step === 2) {
      return (
        form.roundsCount >= 2 &&
        form.roundsCount <= 12 &&
        form.roundDurationMinutes >= 5 &&
        form.roundDurationMinutes <= 180 &&
        form.targetPoints >= 50 &&
        form.targetPoints <= 500
      );
    }
    if (step === 3) {
      if (form.pairs.length < 4) return false;
      // All pairs filled, all emails are non-empty (server validates format).
      return form.pairs.every(
        (p) =>
          p.playerAName.trim().length > 0 &&
          p.playerAEmail.trim().length > 0 &&
          p.playerBName.trim().length > 0 &&
          p.playerBEmail.trim().length > 0,
      );
    }
    return true;
  })();

  const handleSubmit = () => {
    setGlobalError(null);
    startTransition(async () => {
      const result = await createTournament({
        orgSlug,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        prizeDescription: form.prizeDescription.trim() || undefined,
        scheduledStartAt: new Date(form.scheduledStartAt).toISOString(),
        roundsCount: form.roundsCount,
        roundDurationMinutes: form.roundDurationMinutes,
        targetPoints: form.targetPoints,
        pairs: form.pairs.map((p) => ({
          playerAName: p.playerAName.trim(),
          playerAEmail: p.playerAEmail.trim().toLowerCase(),
          playerBName: p.playerBName.trim(),
          playerBEmail: p.playerBEmail.trim().toLowerCase(),
        })),
      });

      if (!result.ok) {
        // Surface fieldErrors when present so users know which field is wrong.
        const fieldErrors = 'fieldErrors' in result ? result.fieldErrors : undefined;
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          const lines = Object.entries(fieldErrors).map(
            ([field, messages]) => `${field}: ${messages.join(', ')}`,
          );
          setGlobalError(`${result.error}\n${lines.join('\n')}`);
        } else {
          setGlobalError(result.error);
        }
        return;
      }
      // Redirect happens client-side — server action returns ok:true.
      window.location.href = `/admin/org/${orgSlug}/tournaments/${result.tournamentId}`;
    });
  };

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((s, idx) => (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                step === s.id
                  ? 'bg-slate-900 text-white'
                  : step > s.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
              }`}
            >
              {step > s.id ? '✓' : s.id}
            </span>
            <span className={step === s.id ? 'font-medium text-slate-900' : 'text-slate-500'}>
              {s.title}
            </span>
            {idx < STEPS.length - 1 && <span className="text-slate-300">→</span>}
          </li>
        ))}
      </ol>

      <div className="rounded-md border border-slate-200 bg-white p-6">
        {step === 1 && <Step1Info form={form} update={updateField} />}
        {step === 2 && <Step2Swiss form={form} update={updateField} />}
        {step === 3 && (
          <Step3Pairs
            pairs={form.pairs}
            updatePair={updatePair}
            addPair={addPair}
            removePair={removePair}
          />
        )}
        {step === 4 && <Step4Review form={form} orgName={orgName} />}
      </div>

      {globalError && (
        <div className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {globalError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || isPending}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          ← Atrás
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(4, s + 1))}
            disabled={!canAdvance}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Siguiente →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {isPending ? 'Creando…' : 'Crear torneo'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Info básica ───────────────────────────────────────────────────────

function Step1Info({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Nombre del torneo" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          maxLength={150}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="Copa Invedin 2026"
        />
      </Field>
      <Field label="Descripción">
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="Breve descripción del torneo, formato, premios…"
        />
      </Field>
      <Field label="Premio">
        <input
          type="text"
          value={form.prizeDescription}
          onChange={(e) => update('prizeDescription', e.target.value)}
          maxLength={500}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="$500 + trofeo"
        />
      </Field>
      <Field label="Fecha de inicio" required>
        <input
          type="datetime-local"
          value={form.scheduledStartAt}
          onChange={(e) => update('scheduledStartAt', e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </Field>
    </div>
  );
}

// ─── Step 2: Configuración Swiss ──────────────────────────────────────────────

function Step2Swiss({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <Field
        label={`Número de rondas: ${form.roundsCount}`}
        hint="Entre 2 y 12. Sugerencia: log2(N_parejas) + 1 redondeado arriba."
      >
        <input
          type="range"
          min={2}
          max={12}
          value={form.roundsCount}
          onChange={(e) => update('roundsCount', Number(e.target.value))}
          className="w-full"
        />
      </Field>
      <Field
        label={`Duración por ronda: ${form.roundDurationMinutes} minutos`}
        hint="Entre 5 y 180 minutos. Típico para parejas: 30-45 min."
      >
        <input
          type="range"
          min={5}
          max={180}
          step={5}
          value={form.roundDurationMinutes}
          onChange={(e) => update('roundDurationMinutes', Number(e.target.value))}
          className="w-full"
        />
      </Field>
      <Field
        label={`Meta de tantos: ${form.targetPoints}`}
        hint="Entre 50 y 500. Estándar dominó: 100/200/300/350. La pareja que llega primero a este valor gana, o la que vaya liderando cuando se acabe el tiempo."
      >
        <input
          type="range"
          min={50}
          max={500}
          step={50}
          value={form.targetPoints}
          onChange={(e) => update('targetPoints', Number(e.target.value))}
          className="w-full"
        />
      </Field>
      <div className="rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <strong>Orden de desempate (fijo):</strong> partidas ganadas → coeficiente
        de efectividad → tantos acumulados → head-to-head.
      </div>
    </div>
  );
}

// ─── Step 3: Parejas ──────────────────────────────────────────────────────────

function Step3Pairs({
  pairs,
  updatePair,
  addPair,
  removePair,
}: {
  pairs: Pair[];
  updatePair: (index: number, key: keyof Pair, value: string) => void;
  addPair: () => void;
  removePair: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Mínimo 4 parejas. Cada jugador necesita un email único — vamos a mandar
        invitaciones para que activen su cuenta.
      </p>
      <ul className="space-y-3">
        {pairs.map((pair, i) => (
          <li key={i} className="rounded-md border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Pareja {i + 1}
              </span>
              {pairs.length > 4 && (
                <button
                  type="button"
                  onClick={() => removePair(i)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Quitar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Nombre jugador A"
                value={pair.playerAName}
                onChange={(e) => updatePair(i, 'playerAName', e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email jugador A"
                value={pair.playerAEmail}
                onChange={(e) => updatePair(i, 'playerAEmail', e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Nombre jugador B"
                value={pair.playerBName}
                onChange={(e) => updatePair(i, 'playerBName', e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email jugador B"
                value={pair.playerBEmail}
                onChange={(e) => updatePair(i, 'playerBEmail', e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addPair}
        className="rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        + Agregar pareja
      </button>
    </div>
  );
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function Step4Review({ form, orgName }: { form: FormState; orgName: string }) {
  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-base font-semibold">Confirmar creación</h3>
      <p className="text-slate-600">
        Vas a crear el torneo <strong>{form.name}</strong> para{' '}
        <strong>{orgName}</strong>.
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-slate-50 px-4 py-3">
        <dt className="text-slate-500">Inicio:</dt>
        <dd className="font-medium">
          {form.scheduledStartAt
            ? new Date(form.scheduledStartAt).toLocaleString('es-VE', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </dd>
        <dt className="text-slate-500">Rondas:</dt>
        <dd className="font-medium">{form.roundsCount}</dd>
        <dt className="text-slate-500">Duración por ronda:</dt>
        <dd className="font-medium">{form.roundDurationMinutes} min</dd>
        <dt className="text-slate-500">Meta de tantos:</dt>
        <dd className="font-medium">{form.targetPoints}</dd>
        <dt className="text-slate-500">Parejas:</dt>
        <dd className="font-medium">{form.pairs.length}</dd>
        {form.prizeDescription && (
          <>
            <dt className="text-slate-500">Premio:</dt>
            <dd className="font-medium">{form.prizeDescription}</dd>
          </>
        )}
      </dl>
      <p className="text-xs text-slate-500">
        El torneo se creará en estado <strong>Borrador</strong>. Las invitaciones
        a las parejas las podrás enviar desde la pantalla de gestión.
      </p>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
