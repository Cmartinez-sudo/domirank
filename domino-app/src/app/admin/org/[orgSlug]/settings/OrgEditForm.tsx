'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateOrganization } from '@/lib/club-pro/org-actions';

type Form = {
  name: string;
  description: string;
  contactEmail: string;
  websiteUrl: string;
  brandPrimaryColor: string;
};

export function OrgEditForm({
  orgSlug,
  initial,
}: {
  orgSlug: string;
  initial: {
    name: string;
    description: string | null;
    contactEmail: string;
    websiteUrl: string | null;
    brandPrimaryColor: string | null;
  };
}) {
  const initialState: Form = {
    name: initial.name,
    description: initial.description ?? '',
    contactEmail: initial.contactEmail,
    websiteUrl: initial.websiteUrl ?? '',
    brandPrimaryColor: initial.brandPrimaryColor ?? '',
  };

  const [form, setForm] = useState<Form>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((s) => ({ ...s, [key]: value }));
    setSuccess(false);
  };

  const dirty = (Object.keys(initialState) as Array<keyof Form>).some(
    (k) => initialState[k] !== form[k],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateOrganization({
        orgSlug,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        contactEmail: form.contactEmail.trim().toLowerCase(),
        websiteUrl: form.websiteUrl.trim() || undefined,
        brandPrimaryColor: form.brandPrimaryColor.trim() || undefined,
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

  return (
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
          placeholder="Quiénes son, qué hacen, opcional."
        />
      </Field>

      <Field
        label="Email de contacto"
        required
        hint="Usado para que jugadores te puedan responder a las invitaciones."
      >
        <input
          type="email"
          value={form.contactEmail}
          onChange={(e) => update('contactEmail', e.target.value)}
          maxLength={255}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </Field>

      <Field label="Sitio web" hint="Opcional. Debe empezar con http:// o https://.">
        <input
          type="url"
          value={form.websiteUrl}
          onChange={(e) => update('websiteUrl', e.target.value)}
          maxLength={500}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="https://"
        />
      </Field>

      <Field
        label="Color principal"
        hint="Hex de 6 dígitos (ej. #0066cc). Aparece como acento en el display público."
      >
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.brandPrimaryColor || '#0f172a'}
            onChange={(e) => update('brandPrimaryColor', e.target.value)}
            className="h-10 w-16 cursor-pointer rounded border border-slate-300"
          />
          <input
            type="text"
            value={form.brandPrimaryColor}
            onChange={(e) => update('brandPrimaryColor', e.target.value)}
            maxLength={7}
            placeholder="#0066cc"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
          />
          {form.brandPrimaryColor && (
            <button
              type="button"
              onClick={() => update('brandPrimaryColor', '')}
              className="text-xs text-slate-500 hover:underline"
            >
              Quitar
            </button>
          )}
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
