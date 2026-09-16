'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { DisplayConfig } from '@/lib/club-pro/display-config';
import { DisplayShell } from '@/app/t/[slug]/DisplayShell';
import {
  SAMPLE_MATCHES,
  SAMPLE_PAIRS,
  SAMPLE_ROUNDS,
  SAMPLE_SPONSORS,
  SAMPLE_TOURNAMENT,
} from '@/lib/club-pro/display-preview-sample';

/**
 * Live preview of the display for the editor.
 *
 * Renders the exact same `DisplayShell` the public /t/[slug] uses, but
 * with sample data + the working (unsaved) config. Two viewport toggles:
 *
 *   - **TV** (1920×1080) — how the display looks projected on the venue TV
 *   - **Mobile** (390×844) — how it looks for a spectator on their phone
 *
 * We scale the inner shell to fit whatever room the panel has, so
 * both toggles render at their real aspect ratio inside the same
 * container. Scale is recomputed on resize via ResizeObserver.
 */

const TV = { width: 1920, height: 1080 };
const MOBILE = { width: 390, height: 844 };

export function PreviewPanel({
  config,
  previewMobile,
  onTogglePreviewMobile,
}: {
  config: DisplayConfig;
  previewMobile: boolean;
  onTogglePreviewMobile: (mobile: boolean) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  // Start with a modest non-zero default so the shell has visible size
  // during the first frame, before the ResizeObserver fires with the
  // real container dimensions.
  const [scale, setScale] = useState(0.3);

  const viewport = previewMobile ? MOBILE : TV;

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const recompute = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      const sx = w / viewport.width;
      const sy = h / viewport.height;
      // Fit both dimensions inside the canvas with a small margin,
      // and clamp to a sensible min so a first-tick miss doesn't hide
      // the preview entirely.
      const next = Math.max(0.1, Math.min(sx, sy) * 0.95);
      setScale(next);
    };
    const observer = new ResizeObserver(recompute);
    observer.observe(el);
    recompute();
    return () => observer.disconnect();
  }, [viewport.width, viewport.height]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Preview
        </span>
        <div className="inline-flex overflow-hidden rounded border border-slate-300">
          <button
            type="button"
            onClick={() => onTogglePreviewMobile(false)}
            className={`border-r border-slate-300 px-3 py-1 text-xs font-medium ${
              !previewMobile
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            📺 TV
          </button>
          <button
            type="button"
            onClick={() => onTogglePreviewMobile(true)}
            className={`px-3 py-1 text-xs font-medium ${
              previewMobile
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            📱 Mobile
          </button>
        </div>
      </div>

      <div
        ref={canvasRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4"
      >
        {/* Outer box takes the SCALED size so the flex centering works
            around a box that visually matches the rendered content.
            Inner wrapper renders at real 1920×1080 (or 390×844) and is
            transform-scaled with `origin: 0 0` — the outer box already
            reserves the correct amount of space. */}
        <div
          style={{
            width: viewport.width * scale,
            height: viewport.height * scale,
            flexShrink: 0,
          }}
          className="overflow-hidden rounded-lg shadow-2xl ring-1 ring-black/10"
        >
          <div
            style={{
              width: viewport.width,
              height: viewport.height,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <DisplayShell
              tournament={SAMPLE_TOURNAMENT}
              pairs={SAMPLE_PAIRS}
              matches={SAMPLE_MATCHES}
              rounds={SAMPLE_ROUNDS}
              sponsors={SAMPLE_SPONSORS}
              config={config}
              preview={{ mobile: previewMobile }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
