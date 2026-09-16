/**
 * Display config — layout of chrome elements around the standings and
 * matches on the public TV screen (/t/[slug]).
 *
 * Persisted as JSONB in `organizations.display_config`. NULL in DB means
 * "use the default" — the resolver below returns DEFAULT_DISPLAY_CONFIG
 * in that case. A parse failure also returns the default, with a
 * warning log so we notice drift.
 *
 * The standings and match panels are NOT configurable; only the chrome
 * around them is (header + footer, plus sponsor placement).
 *
 * Fase 1 (this module) ships the schema + resolver + default. The
 * editor UI arrives in Fase 2.
 */

import { z } from 'zod';

// ─── Elements ──────────────────────────────────────────────────

/** Chrome elements the admin can place / hide / size. */
export const DisplayElementIdSchema = z.enum([
  'domirank-logo',
  'org-logo',
  'tournament-name',
  'round',
  'timer',
  'live',
  'meta',
]);
export type DisplayElementId = z.infer<typeof DisplayElementIdSchema>;

/** T-shirt sizes for elements that support scaling. */
export const DisplaySizeSchema = z.enum(['sm', 'md', 'lg']);
export type DisplaySize = z.infer<typeof DisplaySizeSchema>;

/** Zones an element can live in. Standings / matches are NOT zones. */
export const DisplayZoneIdSchema = z.enum([
  'header-left',
  'header-center',
  'header-right',
  'footer',
]);
export type DisplayZoneId = z.infer<typeof DisplayZoneIdSchema>;

const ElementSlotSchema = z.object({
  id: DisplayElementIdSchema,
  visible: z.boolean(),
  size: DisplaySizeSchema.optional(),
  /**
   * When true, the element is hidden on viewports narrower than the
   * mobile breakpoint. Optional — configs saved before Fase 2 don't
   * carry this field, and read as `undefined` = show everywhere.
   */
  hiddenInMobile: z.boolean().optional(),
});
export type ElementSlot = z.infer<typeof ElementSlotSchema>;

const ZonesSchema = z.object({
  'header-left':   z.array(ElementSlotSchema),
  'header-center': z.array(ElementSlotSchema),
  'header-right':  z.array(ElementSlotSchema),
  'footer':        z.array(ElementSlotSchema),
});
export type DisplayZones = z.infer<typeof ZonesSchema>;

// ─── Sponsors ─────────────────────────────────────────────────

const SponsorsConfigSchema = z.object({
  slotsCount: z.number().int().min(0).max(12),
  zone:       DisplayZoneIdSchema,
  size:       DisplaySizeSchema,
  order:      z.number().int().min(0),
  hiddenInMobile: z.boolean().optional(),
});
export type SponsorsConfig = z.infer<typeof SponsorsConfigSchema>;

// ─── Full config ──────────────────────────────────────────────

export const DisplayConfigSchema = z.object({
  version: z.literal(1),
  desktop: z.object({
    zones: ZonesSchema,
  }),
  mobile: z
    .object({
      zones: ZonesSchema.partial().optional(),
    })
    .optional(),
  sponsors: SponsorsConfigSchema,
});
export type DisplayConfig = z.infer<typeof DisplayConfigSchema>;

// ─── Default ──────────────────────────────────────────────────
//
// Mirrors the layout the display shipped with before this feature.
// Fase 2's editor will initialise its state with this default so admins
// see "the current look" as their starting point.

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  version: 1,
  desktop: {
    zones: {
      'header-left': [
        { id: 'domirank-logo', visible: true, size: 'md' },
      ],
      'header-center': [
        { id: 'org-logo', visible: true, size: 'md' },
        { id: 'tournament-name', visible: true, size: 'md' },
      ],
      'header-right': [
        { id: 'round', visible: true },
        { id: 'timer', visible: true },
        { id: 'live', visible: true },
      ],
      'footer': [
        { id: 'meta', visible: true },
      ],
    },
  },
  sponsors: {
    slotsCount: 2,
    zone: 'footer',
    size: 'md',
    order: 100, // last inside footer (after `meta`, order 0 by array pos)
  },
};

// ─── Resolver ─────────────────────────────────────────────────

/**
 * Turns a raw DB value into a validated DisplayConfig. Falls back to
 * DEFAULT_DISPLAY_CONFIG on any of:
 *   - NULL / undefined (org never set anything)
 *   - JSON that doesn't match the schema (corrupted / version drift)
 *
 * Never throws. Never returns null. Callers can render unconditionally.
 */
export function resolveDisplayConfig(raw: unknown): DisplayConfig {
  if (raw == null) return DEFAULT_DISPLAY_CONFIG;
  const parsed = DisplayConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  console.warn('[display-config] invalid config, falling back to default', {
    issues: parsed.error.issues,
  });
  return DEFAULT_DISPLAY_CONFIG;
}
