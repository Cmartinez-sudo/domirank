'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_DISPLAY_CONFIG,
  type DisplayConfig,
} from '@/lib/club-pro/display-config';
import { updateOrgDisplayConfig } from '@/lib/club-pro/org-actions';
import { ConfigPanel } from './ConfigPanel';
import { PreviewPanel } from './PreviewPanel';

/**
 * Editor client for the display layout config. Split 40/60:
 * config on the left, live preview on the right.
 *
 * State model (grilling decision Q5):
 *   - `initial` mirrors the config persisted in DB (or the default if
 *     the org has no custom config).
 *   - `working` is the local, unsaved edit buffer.
 *   - `dirty` = deep-inequal of the two.
 *
 * Save is explicit — nothing hits the server until the admin clicks
 * "Guardar cambios". `beforeunload` warns before navigating away with
 * unsaved edits, matching the "public display, don't lose work"
 * ergonomics called out in the grilling.
 */
export function DisplayEditorClient({
  orgSlug,
  initialConfig,
  initialHasCustomConfig,
}: {
  orgSlug: string;
  initialConfig: DisplayConfig;
  initialHasCustomConfig: boolean;
}) {
  const router = useRouter();
  const [initial, setInitial] = useState<DisplayConfig>(initialConfig);
  const [working, setWorking] = useState<DisplayConfig>(initialConfig);
  const [hasCustomConfig, setHasCustomConfig] = useState(initialHasCustomConfig);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(
    () => JSON.stringify(initial) !== JSON.stringify(working),
    [initial, working],
  );

  // beforeunload guard — nothing lost accidentally when the admin
  // closes the tab or hits back mid-edit.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const handleReset = useCallback(() => {
    if (
      !window.confirm(
        '¿Volver al layout por defecto? Vas a perder los cambios personalizados. Podés descartar después si te arrepentís.',
      )
    ) {
      return;
    }
    setWorking(DEFAULT_DISPLAY_CONFIG);
    setSaveError(null);
    setSaveSuccess(false);
  }, []);

  const handleDiscard = useCallback(() => {
    setWorking(initial);
    setSaveError(null);
    setSaveSuccess(false);
  }, [initial]);

  const handleSave = useCallback(() => {
    setSaveError(null);
    setSaveSuccess(false);
    startTransition(async () => {
      const result = await updateOrgDisplayConfig({
        orgSlug,
        config: working,
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setInitial(working);
      setHasCustomConfig(true);
      setSaveSuccess(true);
      // Refresh server components so /admin/org/[slug]/tournaments/*
      // sees the new slotsCount immediately on next navigation.
      router.refresh();
    });
  }, [orgSlug, working, router]);

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white">
      <Toolbar
        dirty={dirty}
        hasCustomConfig={hasCustomConfig}
        isPending={isPending}
        saveError={saveError}
        saveSuccess={saveSuccess}
        onReset={handleReset}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
      <div className="flex min-h-0 flex-1 divide-x divide-slate-200">
        <div className="w-[40%] min-w-[380px] overflow-y-auto p-4">
          <ConfigPanel value={working} onChange={setWorking} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <PreviewPanel
            config={working}
            previewMobile={previewMobile}
            onTogglePreviewMobile={setPreviewMobile}
          />
        </div>
      </div>
    </div>
  );
}

function Toolbar({
  dirty,
  hasCustomConfig,
  isPending,
  saveError,
  saveSuccess,
  onReset,
  onDiscard,
  onSave,
}: {
  dirty: boolean;
  hasCustomConfig: boolean;
  isPending: boolean;
  saveError: string | null;
  saveSuccess: boolean;
  onReset: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex min-w-0 flex-col text-xs">
        {saveError ? (
          <span className="text-red-700">Error al guardar: {saveError}</span>
        ) : saveSuccess ? (
          <span className="text-emerald-700">✓ Cambios guardados</span>
        ) : dirty ? (
          <span className="text-amber-700">Cambios sin guardar</span>
        ) : hasCustomConfig ? (
          <span className="text-slate-500">Layout personalizado activo</span>
        ) : (
          <span className="text-slate-500">Layout por defecto (nunca personalizado)</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={isPending}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          ⟲ Restablecer default
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={!dirty || isPending}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || isPending}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
