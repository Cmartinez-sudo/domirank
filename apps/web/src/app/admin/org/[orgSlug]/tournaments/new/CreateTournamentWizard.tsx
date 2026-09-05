'use client';

import { useState, useTransition } from 'react';
import { createTournament } from '@/lib/club-pro/tournament-actions';

type TournamentFormat = 'swiss_pairs' | 'swiss_individual';

type Participant = {
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
  format: TournamentFormat;
  roundsCount: number;
  roundDurationMinutes: number;
  targetPoints: number;
  pairs: Participant[];
};

const EMPTY_PARTICIPANT: Participant = {
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
  format: 'swiss_pairs',
  roundsCount: 5,
  roundDurationMinutes: 30,
  targetPoints: 200,
  pairs: [
    { ...EMPTY_PARTICIPANT },
    { ...EMPTY_PARTICIPANT },
    { ...EMPTY_PARTICIPANT },
    { ...EMPTY_PARTICIPANT },
  ],
};

const STEPS = [
  { id: 1, title: 'Info básica' },
  { id: 2, title: 'Modalidad' },
  { id: 3, title: 'Configuración Swiss' },
  { id: 4, title: 'Participantes' },
  { id: 5, title: 'Revisar y crear' },
] as const;

const LAST_STEP = STEPS.length;

export function CreateTournamentWizard({ orgSlug, orgName }: { orgSlug: string; orgName: string }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
  };

  const updatePair = (index: number, key: keyof Participant, value: string) => {
    setForm((s) => {
      const next = [...s.pairs];
      next[index] = { ...next[index], [key]: value };
      return { ...s, pairs: next };
    });
  };

  const addPair = () => {
    setForm((s) => ({ ...s, pairs: [...s.pairs, { ...EMPTY_PARTICIPANT }] }));
  };

  const removePair = (index: number) => {
    setForm((s) => ({ ...s, pairs: s.pairs.filter((_, i) => i !== index) }));
  };

  const isIndividual = form.format === 'swiss_individual';

  const canAdvance = (() => {
    if (step === 1) {
      return form.name.trim().length >= 3 && form.scheduledStartAt.length > 0;
    }
    if (step === 2) {
      return form.format === 'swiss_pairs' || form.format === 'swiss_individual';
    }
    if (step === 3) {
      return (
        form.roundsCount >= 2 &&
        form.roundsCount <= 12 &&
        form.roundDurationMinutes >= 5 &&
        form.roundDurationMinutes <= 180 &&
        form.targetPoints >= 50 &&
        form.targetPoints <= 500
      );
    }
    if (step === 4) {
      if (form.pairs.length < 4) return false;
      return form.pairs.every((p) => {
        const aOk = p.playerAName.trim().length > 0 && p.playerAEmail.trim().length > 0;
        if (!aOk) return false;
        if (isIndividual) return true;
        return p.playerBName.trim().length > 0 && p.playerBEmail.trim().length > 0;
      });
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
        format: form.format,
        roundsCount: form.roundsCount,
        roundDurationMinutes: form.roundDurationMinutes,
        targetPoints: form.targetPoints,
        pairs: form.pairs.map((p) => ({
          playerAName: p.playerAName.trim(),
          playerAEmail: p.playerAEmail.trim().toLowerCase(),
          playerBName: isIndividual ? '' : p.playerBName.trim(),
          playerBEmail: isIndividual ? '' : p.playerBEmail.trim().toLowerCase(),
        })),
      });

      if (!result.ok) {
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
      window.location.href = `/admin/org/${orgSlug}/tournaments/${result.tournamentId}`;
    });
  };

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
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
        {step === 2 && <Step2Format form={form} update={updateField} />}
        {step === 3 && <Step3Swiss form={form} update={updateField} />}
        {step === 4 && (
          <Step4Participants
            format={form.format}
            pairs={form.pairs}
            updatePair={updatePair}
            addPair={addPair}
            removePair={removePair}
          />
        )}
        {step === 5 && <Step5Review form={form} orgName={orgName} />}
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
        {step < LAST_STEP ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(LAST_STEP, s + 1))}
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

// ─── Step 2: Modalidad ────────────────────────────────────────────────────────

function Step2Format({
  form,
  update,
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Modalidad del torneo</h3>
        <p className="mt-1 text-xs text-slate-500">
          Esta configuración no se puede cambiar después de crear el torneo.
        </p>
      </div>

      <fieldset className="space-y-3" aria-label="Modalidad del torneo">
        <FormatRadio
          name="format"
          value="swiss_pairs"
          checked={form.format === 'swiss_pairs'}
          onChange={() => update('format', 'swiss_pairs')}
          title="Parejas (2v2)"
          description="Los jugadores forman duplas fijas durante todo el torneo."
        />
        <FormatRadio
          name="format"
          value="swiss_individual"
          checked={form.format === 'swiss_individual'}
          onChange={() => update('format', 'swiss_individual')}
          title="Individual (1v1)"
          description="Cada jugador compite solo — uno contra uno por mesa."
        />
      </fieldset>

      <div className="rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600">
        En ambos formatos el sistema Swiss calcula el ranking de la misma manera.
        La única diferencia está en cómo registras a los participantes.
      </div>
    </div>
  );
}

function FormatRadio({
  name,
  value,
  checked,
  onChange,
  title,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
        checked
          ? 'border-slate-900 bg-slate-50'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-500"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-slate-900">{title}</span>
        <span className="text-xs text-slate-500">{description}</span>
      </span>
    </label>
  );
}

// ─── Step 3: Configuración Swiss ──────────────────────────────────────────────

function Step3Swiss({
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
        hint="Entre 2 y 12. Sugerencia: log2(N_participantes) + 1 redondeado arriba."
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
        hint="Entre 5 y 180 minutos. Típico: 30-45 min."
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
        hint="Entre 50 y 500. Estándar dominó: 100/200/300/350. Gana quien llegue primero o lidere al terminarse el tiempo."
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

// ─── Step 4: Participantes ────────────────────────────────────────────────────

function Step4Participants({
  format,
  pairs,
  updatePair,
  addPair,
  removePair,
}: {
  format: TournamentFormat;
  pairs: Participant[];
  updatePair: (index: number, key: keyof Participant, value: string) => void;
  addPair: () => void;
  removePair: (index: number) => void;
}) {
  const isIndividual = format === 'swiss_individual';
  const slotLabel = isIndividual ? 'Jugador' : 'Pareja';
  const addLabel = isIndividual ? '+ Agregar jugador' : '+ Agregar pareja';
  const minLabel = isIndividual ? 'Mínimo 4 jugadores' : 'Mínimo 4 parejas';

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {minLabel}. Cada jugador necesita un email único — vamos a mandar
        invitaciones para que activen su cuenta.
      </p>
      <ul className="space-y-3">
        {pairs.map((pair, i) => (
          <li key={i} className="rounded-md border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {slotLabel} {i + 1}
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
                placeholder={isIndividual ? 'Nombre' : 'Nombre jugador A'}
                value={pair.playerAName}
                onChange={(e) => updatePair(i, 'playerAName', e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder={isIndividual ? 'Email' : 'Email jugador A'}
                value={pair.playerAEmail}
                onChange={(e) => updatePair(i, 'playerAEmail', e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              {!isIndividual && (
                <>
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
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addPair}
        className="rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {addLabel}
      </button>
    </div>
  );
}

// ─── Step 5: Review ───────────────────────────────────────────────────────────

function Step5Review({ form, orgName }: { form: FormState; orgName: string }) {
  const isIndividual = form.format === 'swiss_individual';
  const formatLabel = isIndividual ? 'Individual (1v1)' : 'Parejas (2v2)';
  const slotsLabel = isIndividual ? 'Jugadores' : 'Parejas';

  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-base font-semibold">Confirmar creación</h3>
      <p className="text-slate-600">
        Vas a crear el torneo <strong>{form.name}</strong> para{' '}
        <strong>{orgName}</strong>.
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-slate-50 px-4 py-3">
        <dt className="text-slate-500">Modalidad:</dt>
        <dd className="font-medium">{formatLabel}</dd>
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
        <dt className="text-slate-500">{slotsLabel}:</dt>
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
        las podrás enviar desde la pantalla de gestión.
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
