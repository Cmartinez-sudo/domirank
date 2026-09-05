'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateTournament, cancelTournament } from '@/lib/club-pro/tournament-actions';

type Status = 'draft' | 'registration' | 'ready' | 'in_progress' | 'finished' | 'cancelled';

type Initial = {
  name: string;
  description: string;
  prizeDescription: string;
  scheduledStartAt: string;
  roundsCount: number;
  roundDurationMinutes: number;
  targetPoints: number;
  displaySlug: string;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // datetime-local needs "YYYY-MM-DDTHH:mm" in LOCAL time.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EditForm({
  orgSlug,
  tournamentId,
  status,
  currentRoundNumber,
  initial,
}: {
  orgSlug: string;
  tournamentId: string;
  status: Status;
  currentRoundNumber: number | null;
  initial: {
    name: string;
    description: string | null;
    prizeDescription: string | null;
    scheduledStartAt: string | null;
    roundsCount: number;
    roundDurationMinutes: number;
    targetPoints: number;
    displaySlug: string;
  };
}) {
  const initialState: Initial = {
    name: initial.name,
    description: initial.description ?? '',
    prizeDescription: initial.prizeDescription ?? '',
    scheduledStartAt: toLocalInput(initial.scheduledStartAt),
    roundsCount: initial.roundsCount,
    roundDurationMinutes: initial.roundDurationMinutes,
    targetPoints: initial.targetPoints,
    displaySlug: initial.displaySlug,
  };

  const [form, setForm] = useState<Initial>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCancelling, startCancelling] = useTransition();
  const router = useRouter();

  const inProgress = status === 'in_progress';
  const finishedOrCancelled = status === 'finished' || status === 'cancelled';

  const update = <K extends keyof Initial>(key: K, value: Initial[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
    setSuccess(false);
  };

  const dirty = (Object.keys(initialState) as Array<keyof Initial>).some(
    (k) => initialState[k] !== form[k],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateTournament({
        orgSlug,
        tournamentId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        prizeDescription: form.prizeDescription.trim() || undefined,
        scheduledStartAt: new Date(form.scheduledStartAt).toISOString(),
        roundsCount: form.roundsCount,
        roundDurationMinutes: form.roundDurationMinutes,
        targetPoints: form.targetPoints,
        displaySlug: form.displaySlug.trim(),
      });
      if (!result.ok) {
        const fieldErrors = 'fieldErrors' in result ? result.fieldErrors : undefined;
        if (fieldErrors && Object.keys(fieldErrors).length > 0) {
          const lines = Object.entries(fieldErrors).map(
            ([f, msgs]) => `${f}: ${msgs.join(', ')}`,
          );
          setError(`${result.error}\n${lines.join('\n')}`);
        } else {
          setError(result.error);
        }
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  };

  const handleCancel = () => {
    const ok = confirm(
      '¿Cancelar el torneo definitivamente? Las partidas jugadas se conservan pero no podrá continuar. Esta acción es difícil de revertir.',
    );
    if (!ok) return;
    setError(null);
    startCancelling(async () => {
      const result = await cancelTournament({ orgSlug, tournamentId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (finishedOrCancelled) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Este torneo está {status === 'finished' ? 'finalizado' : 'cancelado'} —
        la información ya no se puede editar.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={150}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </Field>

        <Field label="Descripción">
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </Field>

        <Field label="Premio">
          <input
            type="text"
            value={form.prizeDescription}
            onChange={(e) => update('prizeDescription', e.target.value)}
            maxLength={500}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
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

        <Field
          label={`Rondas: ${form.roundsCount}`}
          hint={
            inProgress
              ? `Va en ronda ${currentRoundNumber}. Reducí a ${currentRoundNumber} para terminar el torneo ahora.`
              : 'Entre 2 y 12.'
          }
        >
          <input
            type="range"
            min={inProgress ? Math.max(2, currentRoundNumber ?? 2) : 2}
            max={12}
            value={form.roundsCount}
            onChange={(e) => update('roundsCount', Number(e.target.value))}
            className="w-full"
          />
        </Field>

        <Field
          label={`Duración por ronda: ${form.roundDurationMinutes} minutos`}
          hint="Entre 5 y 180 minutos. Afecta solo rondas futuras."
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
          hint={
            inProgress
              ? '🔒 No se puede cambiar mientras el torneo está en curso.'
              : 'Entre 50 y 500. Estándar dominó: 100/200/300/350.'
          }
        >
          <input
            type="range"
            min={50}
            max={500}
            step={50}
            value={form.targetPoints}
            onChange={(e) => update('targetPoints', Number(e.target.value))}
            disabled={inProgress}
            className="w-full disabled:opacity-40"
          />
        </Field>

        <Field
          label="URL del display público"
          hint="Si lo cambiás, el link público viejo deja de funcionar. Usá solo letras minúsculas, números y guiones."
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">/t/</span>
            <input
              type="text"
              value={form.displaySlug}
              onChange={(e) =>
                update('displaySlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }
              maxLength={60}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </Field>

        {error && (
          <div className="whitespace-pre-line rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            ✓ Cambios guardados.
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-slate-200 pt-4">
          <button
            type="submit"
            disabled={!dirty || isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setForm(initialState);
                setError(null);
                setSuccess(false);
              }}
              disabled={isPending}
              className="text-sm text-slate-600 hover:underline"
            >
              Descartar
            </button>
          )}
        </div>
      </form>

      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-red-800">
          Zona de peligro
        </h3>
        <p className="mt-1 text-sm text-red-900">
          Cancelar el torneo. Las partidas jugadas se conservan en el historial
          pero el torneo no podrá continuar.
        </p>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          className="mt-3 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
        >
          {isCancelling ? 'Cancelando…' : 'Cancelar torneo'}
        </button>
      </div>
    </div>
  );
}

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
