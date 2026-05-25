import { describe, it, expect } from 'vitest';
import {
  computeTimerState,
  formatMmSs,
  timerDisplayString,
  WARNING_THRESHOLD_SECONDS,
} from '../match-timer-logic';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Crea un ISO string `offsetMs` ms en el pasado desde `nowMs`. */
function startedMsAgo(offsetMs: number, nowMs: number): string {
  return new Date(nowMs - offsetMs).toISOString();
}

const NOW = 1_700_000_000_000; // timestamp fijo para tests

// ─── computeTimerState ────────────────────────────────────────────────────────

describe('computeTimerState', () => {
  it('retorna not_started cuando startedAt es null', () => {
    const state = computeTimerState(null, 30, NOW);
    expect(state.kind).toBe('not_started');
  });

  it('retorna not_started cuando timeLimitMinutes es null', () => {
    const iso = new Date(NOW).toISOString();
    const state = computeTimerState(iso, null, NOW);
    expect(state.kind).toBe('not_started');
  });

  it('retorna not_started cuando ambos son null', () => {
    const state = computeTimerState(null, null, NOW);
    expect(state.kind).toBe('not_started');
  });

  it('retorna running con secondsLeft correcto en el medio del timer', () => {
    // Timer de 30 minutos, arrancó hace 10 minutos → quedan 20 min = 1200 s
    const startedAt = startedMsAgo(10 * 60 * 1000, NOW);
    const state = computeTimerState(startedAt, 30, NOW);
    expect(state.kind).toBe('running');
    if (state.kind === 'running') {
      expect(state.secondsLeft).toBe(1200);
      expect(state.warning).toBe(false);
    }
  });

  it('retorna running con warning=true cuando quedan ≤ 2 minutos', () => {
    // Timer de 30 min, arrancó hace 28 min 30 s → quedan 90 s
    const startedAt = startedMsAgo((28 * 60 + 30) * 1000, NOW);
    const state = computeTimerState(startedAt, 30, NOW);
    expect(state.kind).toBe('running');
    if (state.kind === 'running') {
      expect(state.secondsLeft).toBe(90);
      expect(state.warning).toBe(true);
    }
  });

  it('retorna running con warning=true exactamente en el umbral (120 s)', () => {
    // Timer de 30 min, arrancó hace 28 min exactos → quedan 120 s (umbral)
    const startedAt = startedMsAgo(28 * 60 * 1000, NOW);
    const state = computeTimerState(startedAt, 30, NOW);
    expect(state.kind).toBe('running');
    if (state.kind === 'running') {
      expect(state.secondsLeft).toBe(120);
      expect(state.warning).toBe(true); // <= 120, warning activo
    }
  });

  it('retorna running con warning=false justo antes del umbral (121 s)', () => {
    // Quedan 121 s → no warning todavía
    const remainingMs = 121 * 1000;
    const timeLimitMs = 30 * 60 * 1000;
    const startedAt = startedMsAgo(timeLimitMs - remainingMs, NOW);
    const state = computeTimerState(startedAt, 30, NOW);
    expect(state.kind).toBe('running');
    if (state.kind === 'running') {
      expect(state.secondsLeft).toBe(121);
      expect(state.warning).toBe(false);
    }
  });

  it('retorna expired cuando el tiempo se agotó', () => {
    // Timer de 30 min, arrancó hace 31 min → ya expiró
    const startedAt = startedMsAgo(31 * 60 * 1000, NOW);
    const state = computeTimerState(startedAt, 30, NOW);
    expect(state.kind).toBe('expired');
  });

  it('retorna expired exactamente cuando now === end', () => {
    // now == end → remainingMs = 0 → expired
    const startedAt = startedMsAgo(30 * 60 * 1000, NOW);
    // now = startedAt + 30 min exacto → remainingMs = 0
    const state = computeTimerState(startedAt, 30, NOW);
    expect(state.kind).toBe('expired');
  });

  it('funciona con timer de 1 minuto', () => {
    // Timer de 1 min, arrancó hace 30 s → quedan 30 s
    const startedAt = startedMsAgo(30 * 1000, NOW);
    const state = computeTimerState(startedAt, 1, NOW);
    expect(state.kind).toBe('running');
    if (state.kind === 'running') {
      expect(state.secondsLeft).toBe(30);
      expect(state.warning).toBe(true); // 30 <= 120 → warning
    }
  });

  it('funciona con timer de 60 minutos', () => {
    // Timer de 60 min, arrancó hace 1 min → quedan 59 min = 3540 s
    const startedAt = startedMsAgo(60 * 1000, NOW);
    const state = computeTimerState(startedAt, 60, NOW);
    expect(state.kind).toBe('running');
    if (state.kind === 'running') {
      expect(state.secondsLeft).toBe(3540);
      expect(state.warning).toBe(false);
    }
  });

  it('WARNING_THRESHOLD_SECONDS exportado es 120', () => {
    expect(WARNING_THRESHOLD_SECONDS).toBe(120);
  });
});

// ─── formatMmSs ──────────────────────────────────────────────────────────────

describe('formatMmSs', () => {
  it('0 → "0:00"', () => {
    expect(formatMmSs(0)).toBe('0:00');
  });

  it('5 → "0:05"', () => {
    expect(formatMmSs(5)).toBe('0:05');
  });

  it('59 → "0:59"', () => {
    expect(formatMmSs(59)).toBe('0:59');
  });

  it('60 → "1:00"', () => {
    expect(formatMmSs(60)).toBe('1:00');
  });

  it('90 → "1:30"', () => {
    expect(formatMmSs(90)).toBe('1:30');
  });

  it('120 → "2:00"', () => {
    expect(formatMmSs(120)).toBe('2:00');
  });

  it('1800 → "30:00"', () => {
    expect(formatMmSs(1800)).toBe('30:00');
  });

  it('3600 → "60:00"', () => {
    expect(formatMmSs(3600)).toBe('60:00');
  });

  it('valores negativos se normalizan a 0:00', () => {
    expect(formatMmSs(-1)).toBe('0:00');
  });

  it('valores decimales se truncan', () => {
    expect(formatMmSs(90.9)).toBe('1:30');
  });
});

// ─── timerDisplayString ───────────────────────────────────────────────────────

describe('timerDisplayString', () => {
  it('not_started → "--:--"', () => {
    expect(timerDisplayString({ kind: 'not_started' })).toBe('--:--');
  });

  it('expired → "0:00"', () => {
    expect(timerDisplayString({ kind: 'expired' })).toBe('0:00');
  });

  it('running 90 s → "1:30"', () => {
    expect(timerDisplayString({ kind: 'running', secondsLeft: 90, warning: true })).toBe('1:30');
  });

  it('running 1800 s → "30:00"', () => {
    expect(timerDisplayString({ kind: 'running', secondsLeft: 1800, warning: false })).toBe('30:00');
  });
});
