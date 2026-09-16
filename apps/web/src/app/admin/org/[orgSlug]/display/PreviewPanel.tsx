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
  const [scale, setScale] = useState(1);

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
      // Fit both dimensions inside the canvas with a small margin.
      setScale(Math.min(sx, sy) * 0.95);
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
        {/* Scaled wrapper so the shell renders at its real 1920×1080
            (or 390×844) size, then we transform-scale to fit. */}
        <div
          style={{
            width: viewport.width,
            height: viewport.height,
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            flexShrink: 0,
          }}
          className="overflow-hidden rounded-lg shadow-2xl ring-1 ring-black/10"
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
  );
}
