'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { uploadTournamentAsset, clearTournamentAsset } from '@/lib/club-pro/upload-actions';

type Slot = 'logo' | 'sponsor_1' | 'sponsor_2';

const SLOT_LABEL: Record<Slot, string> = {
  logo: 'Logo del torneo',
  sponsor_1: 'Sponsor 1',
  sponsor_2: 'Sponsor 2',
};

export function AssetUploader({
  orgSlug,
  tournamentId,
  slot,
  currentUrl,
}: {
  orgSlug: string;
  tournamentId: string;
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
    formData.append('tournamentId', tournamentId);
    formData.append('slot', slot);
    formData.append('file', file);

    startTransition(async () => {
      const result = await uploadTournamentAsset(formData);
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
      const result = await clearTournamentAsset({ orgSlug, tournamentId, slot });
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex items-start gap-3">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt={SLOT_LABEL[slot]}
          className="h-16 w-16 shrink-0 rounded border border-slate-200 bg-white object-contain p-1"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400">
          Sin imagen
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
          PNG, JPG, WebP o SVG · máx 500 KB
        </div>
        {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
      </div>
    </div>
  );
}
