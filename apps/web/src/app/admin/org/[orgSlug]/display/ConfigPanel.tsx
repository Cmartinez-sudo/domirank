'use client';

import { useMemo } from 'react';
import type {
  DisplayConfig,
  DisplayElementId,
  DisplayZoneId,
  DisplaySize,
  ElementSlot,
} from '@/lib/club-pro/display-config';

/**
 * Left-side panel of the editor. Two sections:
 *
 *   1. "Elementos" — a unified list of every chrome element with
 *      visibility + zone + order (arrows) + size + hide-in-mobile.
 *      Grilling decision Q4: unified list over per-zone tabs.
 *
 *   2. "Sponsors" — logo group config: slotsCount + zone + size +
 *      hide-in-mobile.
 *
 * Editing is direct: each control mutates the working config via a
 * pure helper. The parent (`DisplayEditorClient`) tracks dirty state.
 */

const ZONE_LABEL: Record<DisplayZoneId, string> = {
  'header-left': 'Header · izquierda',
  'header-center': 'Header · centro',
  'header-right': 'Header · derecha',
  'footer': 'Footer',
};

const ZONE_OPTIONS: DisplayZoneId[] = [
  'header-left',
  'header-center',
  'header-right',
  'footer',
];

const SIZE_OPTIONS: DisplaySize[] = ['sm', 'md', 'lg'];

const ELEMENT_META: Record<
  DisplayElementId,
  { label: string; icon: string; supportsSize: boolean }
> = {
  'domirank-logo':   { label: 'Logo DomiRank',   icon: '🎯', supportsSize: true  },
  'org-logo':        { label: 'Logo del club',   icon: '🏛', supportsSize: false },
  'tournament-name': { label: 'Nombre torneo',   icon: '📛', supportsSize: true  },
  'round':           { label: 'Ronda actual',    icon: '🔢', supportsSize: false },
  'timer':           { label: 'Timer',           icon: '⏱',  supportsSize: false },
  'live':            { label: 'Estado (En vivo)', icon: '🟢', supportsSize: false },
  'meta':            { label: 'Meta de tantos',  icon: '🎯', supportsSize: false },
};

const ALL_ELEMENT_IDS: DisplayElementId[] = [
  'domirank-logo',
  'org-logo',
  'tournament-name',
  'round',
  'timer',
  'live',
  'meta',
];

export function ConfigPanel({
  value,
  onChange,
}: {
  value: DisplayConfig;
  onChange: (next: DisplayConfig) => void;
}) {
  // Build a flat view: for each element, find its (zone, index) in the
  // config so the UI can render everything as a single list regardless
  // of the underlying zone bucketing.
  const rows = useMemo(() => buildElementRows(value), [value]);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Elementos
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Podés ocultar cualquier elemento, moverlo a otra zona del layout, o
          reordenarlo dentro de su zona. La clasificación y las mesas no se
          tocan — siempre ocupan el centro de la pantalla.
        </p>
        <ul className="space-y-2">
          {rows.map((row) => (
            <ElementRow
              key={row.id}
              row={row}
              value={value}
              onChange={onChange}
            />
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Sponsors
        </h2>
        <SponsorsCard value={value} onChange={onChange} />
      </section>
    </div>
  );
}

type Row = {
  id: DisplayElementId;
  zone: DisplayZoneId;
  indexInZone: number;
  visible: boolean;
  size: DisplaySize;
  hiddenInMobile: boolean;
};

function buildElementRows(config: DisplayConfig): Row[] {
  const found = new Map<DisplayElementId, Row>();
  for (const zone of ZONE_OPTIONS) {
    const slots = config.desktop.zones[zone] ?? [];
    slots.forEach((slot, idx) => {
      // Guard against a corrupted config having the same element in two
      // zones. First occurrence wins; the UI never lists an element twice.
      if (found.has(slot.id)) return;
      found.set(slot.id, {
        id: slot.id,
        zone,
        indexInZone: idx,
        visible: slot.visible,
        size: slot.size ?? 'md',
        hiddenInMobile: slot.hiddenInMobile ?? false,
      });
    });
  }
  // Any element that isn't in the config gets a synthetic "not placed"
  // row so the admin can still see + place it. Default zone follows the
  // DEFAULT_DISPLAY_CONFIG for that id.
  for (const id of ALL_ELEMENT_IDS) {
    if (found.has(id)) continue;
    found.set(id, {
      id,
      zone: guessDefaultZone(id),
      indexInZone: 0,
      visible: false,
      size: 'md',
      hiddenInMobile: false,
    });
  }
  return ALL_ELEMENT_IDS.map((id) => found.get(id)!);
}

function guessDefaultZone(id: DisplayElementId): DisplayZoneId {
  if (id === 'domirank-logo') return 'header-left';
  if (id === 'org-logo' || id === 'tournament-name') return 'header-center';
  if (id === 'round' || id === 'timer' || id === 'live') return 'header-right';
  return 'footer';
}

function ElementRow({
  row,
  value,
  onChange,
}: {
  row: Row;
  value: DisplayConfig;
  onChange: (next: DisplayConfig) => void;
}) {
  const meta = ELEMENT_META[row.id];
  const canMoveUp = row.visible && row.indexInZone > 0;
  const canMoveDown =
    row.visible && row.indexInZone < (value.desktop.zones[row.zone]?.length ?? 0) - 1;

  const updateSlot = (updater: (slot: ElementSlot) => ElementSlot) => {
    onChange(mutateSlot(value, row.id, updater));
  };

  const moveInZone = (direction: -1 | 1) => {
    onChange(moveSlotWithinZone(value, row.id, direction));
  };

  const changeZone = (nextZone: DisplayZoneId) => {
    onChange(moveSlotToZone(value, row.id, nextZone));
  };

  return (
    <li className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-lg leading-none" aria-hidden="true">
          {meta.icon}
        </span>
        <span className="mr-2 flex-1 truncate text-sm font-medium text-slate-900">
          {meta.label}
        </span>

        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={row.visible}
            onChange={(e) => updateSlot((s) => ({ ...s, visible: e.target.checked }))}
          />
          Visible
        </label>

        <select
          value={row.zone}
          onChange={(e) => changeZone(e.target.value as DisplayZoneId)}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          {ZONE_OPTIONS.map((z) => (
            <option key={z} value={z}>
              {ZONE_LABEL[z]}
            </option>
          ))}
        </select>

        <div className="inline-flex overflow-hidden rounded border border-slate-300">
          <button
            type="button"
            onClick={() => moveInZone(-1)}
            disabled={!canMoveUp}
            className="border-r border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            aria-label="Mover arriba en la zona"
            title="Mover arriba en la zona"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => moveInZone(1)}
            disabled={!canMoveDown}
            className="px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-30"
            aria-label="Mover abajo en la zona"
            title="Mover abajo en la zona"
          >
            ↓
          </button>
        </div>

        {meta.supportsSize && (
          <div className="inline-flex overflow-hidden rounded border border-slate-300">
            {SIZE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateSlot((slot) => ({ ...slot, size: s }))}
                className={`border-r border-slate-300 px-2 py-1 text-xs last:border-r-0 ${
                  row.size === s
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={row.hiddenInMobile}
          onChange={(e) =>
            updateSlot((s) => ({ ...s, hiddenInMobile: e.target.checked }))
          }
        />
        Ocultar en mobile
      </label>
    </li>
  );
}

function SponsorsCard({
  value,
  onChange,
}: {
  value: DisplayConfig;
  onChange: (next: DisplayConfig) => void;
}) {
  const s = value.sponsors;
  const update = (next: Partial<DisplayConfig['sponsors']>) => {
    onChange({ ...value, sponsors: { ...s, ...next } });
  };

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">
        Cuántos logos de sponsors mostrar en cada torneo, y dónde caen. Los
        logos concretos se suben desde la configuración de cada torneo.
      </p>

      <label className="block">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-medium text-slate-700">
            Cantidad de slots
          </span>
          <span className="font-mono text-xs text-slate-500">
            {s.slotsCount}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={12}
          value={s.slotsCount}
          onChange={(e) => update({ slotsCount: Number(e.target.value) })}
          className="w-full"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          0 esconde la sección de sponsors por completo.
        </p>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">
          Zona
        </span>
        <select
          value={s.zone}
          onChange={(e) => update({ zone: e.target.value as DisplayZoneId })}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          {ZONE_OPTIONS.map((z) => (
            <option key={z} value={z}>
              {ZONE_LABEL[z]}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1 block text-xs font-medium text-slate-700">Tamaño</span>
        <div className="inline-flex overflow-hidden rounded border border-slate-300">
          {SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => update({ size })}
              className={`border-r border-slate-300 px-3 py-1 text-xs last:border-r-0 ${
                s.size === size
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {size.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={s.hiddenInMobile ?? false}
          onChange={(e) => update({ hiddenInMobile: e.target.checked })}
        />
        Ocultar sponsors en mobile
      </label>
    </div>
  );
}

// ─── Pure helpers on the config ────────────────────────────────

function mutateSlot(
  config: DisplayConfig,
  id: DisplayElementId,
  updater: (slot: ElementSlot) => ElementSlot,
): DisplayConfig {
  const zones = cloneZones(config.desktop.zones);
  let found = false;
  for (const zone of ZONE_OPTIONS) {
    const slots = zones[zone];
    const idx = slots.findIndex((s) => s.id === id);
    if (idx === -1) continue;
    slots[idx] = updater(slots[idx]);
    found = true;
    break;
  }
  if (!found) {
    // Element wasn't placed anywhere — insert into its default zone as
    // visible so the toggle-on-first-touch flow works.
    const zone = guessDefaultZone(id);
    zones[zone].push(
      updater({ id, visible: true, size: 'md' }),
    );
  }
  return { ...config, desktop: { zones } };
}

function moveSlotWithinZone(
  config: DisplayConfig,
  id: DisplayElementId,
  direction: -1 | 1,
): DisplayConfig {
  const zones = cloneZones(config.desktop.zones);
  for (const zone of ZONE_OPTIONS) {
    const slots = zones[zone];
    const idx = slots.findIndex((s) => s.id === id);
    if (idx === -1) continue;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= slots.length) return config;
    [slots[idx], slots[swapIdx]] = [slots[swapIdx], slots[idx]];
    return { ...config, desktop: { zones } };
  }
  return config;
}

function moveSlotToZone(
  config: DisplayConfig,
  id: DisplayElementId,
  nextZone: DisplayZoneId,
): DisplayConfig {
  const zones = cloneZones(config.desktop.zones);
  let removed: ElementSlot | null = null;
  for (const zone of ZONE_OPTIONS) {
    const slots = zones[zone];
    const idx = slots.findIndex((s) => s.id === id);
    if (idx === -1) continue;
    if (zone === nextZone) return config; // no-op
    [removed] = slots.splice(idx, 1);
    break;
  }
  if (!removed) {
    removed = { id, visible: true, size: 'md' };
  }
  zones[nextZone].push(removed);
  return { ...config, desktop: { zones } };
}

function cloneZones(zones: DisplayConfig['desktop']['zones']): DisplayConfig['desktop']['zones'] {
  return {
    'header-left': [...zones['header-left']],
    'header-center': [...zones['header-center']],
    'header-right': [...zones['header-right']],
    'footer': [...zones['footer']],
  };
}
