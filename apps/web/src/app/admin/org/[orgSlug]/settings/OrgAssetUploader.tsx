'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { uploadOrgAsset, clearOrgAsset } from '@/lib/club-pro/org-actions';

type Slot = 'logo';

const SLOT_LABEL: Record<Slot, string> = {
  logo: 'Logo de la organización',
};

export function OrgAssetUploader({
  orgSlug,
  slot,
  currentUrl,
}: {
  orgSlug: string;
  slot: Slot;
  currentUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > 512_000) {
      setError('El archivo supera 500 KB');
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('orgSlug', orgSlug);
    formData.append('slot', slot);
    formData.append('file', file);

    startTransition(async () => {
      const result = await uploadOrgAsset(formData);
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
      if (inputRef.current) inputRef.current.value = '';
    });
  };

  const handleClear = () => {
    if (!confirm(`¿Quitar ${SLOT_LABEL[slot].toLowerCase()}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await clearOrgAsset({ orgSlug, slot });
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-start gap-4">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt={SLOT_LABEL[slot]}
          className="h-20 w-20 shrink-0 rounded border border-slate-200 bg-white object-contain p-1"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">
          Sin logo
        </div>
      )}
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-900">{SLOT_LABEL[slot]}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleChange}
            disabled={isPending}
            className="block text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800 disabled:opacity-40"
          />
          {currentUrl && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isPending}
              className="text-xs text-red-700 hover:underline disabled:opacity-40"
            >
              Quitar
            </button>
          )}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          PNG, JPG, WebP o SVG · máx 500 KB. Aparece en el display público y
          en los emails de invitación.
        </div>
        {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
      </div>
    </div>
  );
}
