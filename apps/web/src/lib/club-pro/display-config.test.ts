import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_DISPLAY_CONFIG,
  resolveDisplayConfig,
  type DisplayConfig,
} from './display-config';

describe('resolveDisplayConfig', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns default when raw is null (org never configured)', () => {
    expect(resolveDisplayConfig(null)).toEqual(DEFAULT_DISPLAY_CONFIG);
    // Silent — NULL is the expected "no config yet" signal, not a bug.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns default when raw is undefined', () => {
    expect(resolveDisplayConfig(undefined)).toEqual(DEFAULT_DISPLAY_CONFIG);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns default when raw is not an object', () => {
    expect(resolveDisplayConfig('not a config')).toEqual(DEFAULT_DISPLAY_CONFIG);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns default when version does not match', () => {
    expect(resolveDisplayConfig({ ...DEFAULT_DISPLAY_CONFIG, version: 99 })).toEqual(
      DEFAULT_DISPLAY_CONFIG,
    );
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns default when a required zone is missing', () => {
    const bad = {
      ...DEFAULT_DISPLAY_CONFIG,
      desktop: {
        zones: {
          'header-left': [],
          'header-center': [],
          'header-right': [],
          'footer-left': [],
          // footer-right missing
        },
      },
    };
    expect(resolveDisplayConfig(bad)).toEqual(DEFAULT_DISPLAY_CONFIG);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns default when sponsors.slotsCount exceeds max', () => {
    const bad: DisplayConfig = {
      ...DEFAULT_DISPLAY_CONFIG,
      sponsors: { ...DEFAULT_DISPLAY_CONFIG.sponsors, slotsCount: 999 },
    };
    expect(resolveDisplayConfig(bad)).toEqual(DEFAULT_DISPLAY_CONFIG);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns the parsed config when valid', () => {
    const custom: DisplayConfig = {
      version: 1,
      desktop: {
        zones: {
          'header-left': [{ id: 'org-logo', visible: true, size: 'lg' }],
          'header-center': [{ id: 'tournament-name', visible: true, size: 'lg' }],
          'header-right': [
            { id: 'round', visible: true },
            { id: 'timer', visible: true },
          ],
          'footer-left': [
            { id: 'domirank-logo', visible: true, size: 'sm' },
            { id: 'meta', visible: true },
          ],
          'footer-right': [],
        },
      },
      sponsors: { slotsCount: 4, zone: 'header-left', size: 'sm', order: 5 },
    };
    expect(resolveDisplayConfig(custom)).toEqual(custom);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('accepts a partial mobile override', () => {
    const custom: DisplayConfig = {
      ...DEFAULT_DISPLAY_CONFIG,
      mobile: {
        zones: {
          'footer-left': [{ id: 'meta', visible: false }],
        },
      },
    };
    expect(resolveDisplayConfig(custom)).toEqual(custom);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('accepts hiddenInMobile flag on element slots (fase 2)', () => {
    const custom: DisplayConfig = {
      ...DEFAULT_DISPLAY_CONFIG,
      desktop: {
        zones: {
          ...DEFAULT_DISPLAY_CONFIG.desktop.zones,
          'header-right': [
            { id: 'round', visible: true, hiddenInMobile: false },
            { id: 'timer', visible: true, hiddenInMobile: true },
            { id: 'live', visible: true },
          ],
        },
      },
    };
    expect(resolveDisplayConfig(custom)).toEqual(custom);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('accepts hiddenInMobile flag on sponsors (fase 2)', () => {
    const custom: DisplayConfig = {
      ...DEFAULT_DISPLAY_CONFIG,
      sponsors: { ...DEFAULT_DISPLAY_CONFIG.sponsors, hiddenInMobile: true },
    };
    expect(resolveDisplayConfig(custom)).toEqual(custom);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('is backward compatible with pre-fase-2 configs (no hiddenInMobile field)', () => {
    // A config saved by fase 1 doesn't carry hiddenInMobile — must
    // still validate and read as undefined (= show everywhere).
    expect(resolveDisplayConfig(DEFAULT_DISPLAY_CONFIG)).toEqual(
      DEFAULT_DISPLAY_CONFIG,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('default matches what the display shipped with pre-editor', () => {
    // Regression guard: the code-side default MUST render the same
    // chrome as the layout the display had before this feature landed.
    // If someone rearranges DEFAULT_DISPLAY_CONFIG they should update
    // this test consciously — that's the point.
    expect(DEFAULT_DISPLAY_CONFIG.desktop.zones['header-left']).toEqual([
      { id: 'domirank-logo', visible: true, size: 'md' },
    ]);
    expect(DEFAULT_DISPLAY_CONFIG.desktop.zones['header-center']).toEqual([
      { id: 'org-logo', visible: true, size: 'md' },
      { id: 'tournament-name', visible: true, size: 'md' },
    ]);
    expect(DEFAULT_DISPLAY_CONFIG.desktop.zones['header-right']).toEqual([
      { id: 'round', visible: true },
      { id: 'timer', visible: true },
      { id: 'live', visible: true },
    ]);
    expect(DEFAULT_DISPLAY_CONFIG.desktop.zones['footer-left']).toEqual([
      { id: 'meta', visible: true },
    ]);
    expect(DEFAULT_DISPLAY_CONFIG.desktop.zones['footer-right']).toEqual([]);
    expect(DEFAULT_DISPLAY_CONFIG.sponsors).toEqual({
      slotsCount: 2,
      zone: 'footer-right',
      size: 'md',
      order: 0,
    });
  });
});
