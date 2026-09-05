/**
 * Tests para la lógica de `session_day(timestamptz, tz)` definida en SQL
 * (mig 0051) — el RPC continuous_league_daily_standings la usa para
 * agrupar partidas por día con cutoff a 5am Caracas (UTC-4).
 *
 * IMPORTANTE: la función SQL real NO se puede invocar desde JS sin DB.
 * Acá replicamos la FÓRMULA en JS para:
 *  1) Documentar el comportamiento esperado con ejemplos concretos.
 *  2) Atrapar regresiones si alguien la rompe en SQL: si cambian la
 *     fórmula allá, tienen que actualizar este test acá también.
 *
 * La verificación end-to-end de la función SQL real se hace vía consultas
 * SQL (no via vitest).
 */
import { describe, it, expect } from "vitest";

/**
 * Replica de la fórmula de `session_day(timestamptz, tz)`:
 *   session_day(ts, tz) = ((ts AT TIME ZONE tz) - INTERVAL '5 hours')::date
 *
 * Para Caracas (UTC-4 sin DST) usamos tzOffsetHours = -4.
 */
function sessionDay(iso: string, tzOffsetHours: number = -4): string {
  const utcMs = new Date(iso).getTime();
  const localMs = utcMs + tzOffsetHours * 60 * 60 * 1000;
  const adjustedMs = localMs - 5 * 60 * 60 * 1000;
  return new Date(adjustedMs).toISOString().slice(0, 10);
}

describe("session_day (SQL formula replicada en JS)", () => {
  it("sábado 9pm Caracas → ese mismo sábado", () => {
    // 21:00 Caracas = 01:00 UTC del día siguiente
    expect(sessionDay("2026-05-30T21:00:00-04:00")).toBe("2026-05-30");
  });

  it("domingo 1am Caracas → todavía sábado (antes del cutoff 5am)", () => {
    expect(sessionDay("2026-05-31T01:00:00-04:00")).toBe("2026-05-30");
  });

  it("domingo 4:59am Caracas → último segundo del sábado", () => {
    expect(sessionDay("2026-05-31T04:59:59-04:00")).toBe("2026-05-30");
  });

  it("domingo 5:00am Caracas → cambio de session_day a domingo", () => {
    expect(sessionDay("2026-05-31T05:00:00-04:00")).toBe("2026-05-31");
  });

  it("domingo 6am Caracas → domingo", () => {
    expect(sessionDay("2026-05-31T06:00:00-04:00")).toBe("2026-05-31");
  });

  it("mediodía de un día cualquiera → mismo día calendario", () => {
    expect(sessionDay("2026-05-15T12:00:00-04:00")).toBe("2026-05-15");
    expect(sessionDay("2026-01-01T12:00:00-04:00")).toBe("2026-01-01");
    expect(sessionDay("2026-12-31T12:00:00-04:00")).toBe("2026-12-31");
  });

  it("medianoche exacta Caracas → todavía cuenta como día anterior", () => {
    // 00:00 del 31 mayo Caracas está antes del cutoff 5am → 30 mayo
    expect(sessionDay("2026-05-31T00:00:00-04:00")).toBe("2026-05-30");
  });

  it("input en formato UTC también funciona (offset conservado)", () => {
    // 2026-05-31T02:00:00Z = 2026-05-30T22:00:00-04:00 → sábado 30
    expect(sessionDay("2026-05-31T02:00:00Z")).toBe("2026-05-30");
    // 2026-05-31T09:00:00Z = 2026-05-31T05:00:00-04:00 → cutoff exacto → domingo 31
    expect(sessionDay("2026-05-31T09:00:00Z")).toBe("2026-05-31");
  });
});
