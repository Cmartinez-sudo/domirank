# Rediseño de Perfil DomiRank — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arreglar el 404 del tab Perfil y rediseñar `/profile/[username]` con métricas (curva Elo, win rate + efectividad, actividad/rachas, pareja/rival, H2H, mini-ranking amigos), gating por amistad y SVG propio sin nuevas dependencias.

**Architecture:** Server components con agregación server-side en un helper nuevo `src/lib/profile-stats.ts`. Componentes de chart en `src/components/charts/` reciben datos ya computados. Dos queries paralelas (historial rico 50 + serie Elo light 200). Privacidad gateada por `getRelationStatus`. Toggle amigos en `/leaderboard` con query param `?scope=friends|global`. Todo entregable en 3 PRs incrementales, cada uno mergeable.

**Tech Stack:** Next.js 14 App Router, Supabase, React server components, framer-motion (ya instalada), TailwindCSS con tokens de marca, SVG propio. Sin librerías nuevas.

---

## Decisiones cerradas (grilling 2026-09-01)

- **Privacidad:** Público → header, DomiRank, win rate, total partidas, tier, reliability, pareja favorita, rival principal. Solo amigos + propio → curva Elo, heatmap/rachas, form strip, historial completo, H2H.
- **Curva Elo:** Solo global (no filtro por modalidad). Selector 10/50/Todas. Cap 200 filas, agregación por día si >100. Pico marcado.
- **Stat-tiles:** Partidas / Win rate / Efectividad / Mejor racha.
- **Rachas:** Bidireccionales en "Racha actual" (V y D). Mejor racha solo victorias. Solo `confirmed`.
- **ModalityCard:** Se conserva. No mini-anillos por modalidad.
- **Novatos:** 0 → CTA único (propio); 1–4 → básico (header + tiles + historial); ≥5 → completo. `NR_THRESHOLD = 5` ya coincide.
- **Historial:** Botón "Ver más" client-side, 10 → 50.
- **Heatmap:** 12 semanas × 7 días, estilo GitHub, todas confirmed, tap → tooltip.
- **H2H:** Card grande con enfrentamiento + línea pequeña "juntos".
- **Mini-ranking amigos:** `/leaderboard?scope=friends` + preview top-5 en tu propio perfil.
- **Perf:** 2 queries paralelas (Promise.all). Mini-ranking = 1 query `in('id', friendIds)`.

---

## Estructura de archivos

**Nuevos:**
- `src/app/profile/page.tsx` — redirect al perfil propio (fix 404)
- `src/lib/profile-stats.ts` — helpers server-side (streaks, elo series, H2H, mini-ranking)
- `src/lib/__tests__/profile-stats.test.ts` — tests unitarios
- `src/components/charts/LineChart.tsx`
- `src/components/charts/RingStat.tsx`
- `src/components/charts/BarStat.tsx`
- `src/components/charts/ActivityHeatmap.tsx`
- `src/components/charts/FormStrip.tsx`
- `src/components/profile/StatTiles.tsx`
- `src/components/profile/EloCurveSection.tsx` (client — maneja el selector de rango)
- `src/components/profile/StreaksSection.tsx`
- `src/components/profile/H2HCard.tsx`
- `src/components/profile/FriendsPreview.tsx`
- `src/components/profile/HistoryList.tsx` (client — botón "Ver más")
- `src/components/leaderboard/ScopeToggle.tsx` (client)

**Modificados:**
- `src/app/profile/[username]/page.tsx` — refactor completo, nueva estructura
- `src/app/leaderboard/page.tsx` — soporte `?scope=friends`
- `src/components/AppShell.tsx` — mantener tab `/profile` (redirect lo resuelve)

---

# PR 1 — Fix del 404 + Helpers server-side

**Objetivo:** El tab Perfil deja de dar 404. La lógica de agregación queda extraída, testeada, y la página consumidora sigue viéndose igual que antes.

## Task 1: Crear `src/app/profile/page.tsx` con redirect

**Files:**
- Create: `src/app/profile/page.tsx`

- [ ] **Step 1: Escribir el server component de redirect**

Crear `src/app/profile/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfileIndex() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/profile");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!profile?.username) {
    redirect("/login?redirectTo=/profile");
  }

  redirect(`/profile/${profile.username}`);
}
```

- [ ] **Step 2: Verificar navegación manual**

Correr `pnpm dev` y navegar a `http://localhost:3000/profile` con sesión activa → debe redirigir a `/profile/<tu-username>`. Sin sesión → `/login?redirectTo=/profile`.

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "fix(profile): add /profile redirect to own profile

Fixes 404 when tapping Perfil tab. Redirects logged-in users to
/profile/{username}; anonymous users to /login with redirectTo."
```

---

## Task 2: Extraer helpers a `src/lib/profile-stats.ts`

**Files:**
- Create: `src/lib/profile-stats.ts`
- Create: `src/lib/__tests__/profile-stats.test.ts`

- [ ] **Step 1: Escribir tests que fallen (TDD)**

Crear `src/lib/__tests__/profile-stats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeStreaks,
  aggregateEloSeries,
  computePartnerRivalStats,
  computeHeadToHead,
} from "../profile-stats";

const mkRow = (rank: number, elo_before: number, elo_after: number, created_at: string, team = 1) => ({
  rank,
  team,
  elo_before,
  elo_after,
  created_at,
  matches: { status: "confirmed" as const, match_players: [] as any[] },
});

describe("computeStreaks", () => {
  it("returns zero streaks for empty history", () => {
    expect(computeStreaks([])).toEqual({ current: { kind: "none", count: 0 }, best: 0 });
  });

  it("computes current W streak", () => {
    const rows = [
      mkRow(1, 1500, 1520, "2026-09-01"),
      mkRow(1, 1480, 1500, "2026-08-31"),
      mkRow(2, 1500, 1480, "2026-08-30"),
    ];
    const r = computeStreaks(rows);
    expect(r.current).toEqual({ kind: "wins", count: 2 });
  });

  it("computes current L streak", () => {
    const rows = [
      mkRow(2, 1520, 1500, "2026-09-01"),
      mkRow(2, 1540, 1520, "2026-08-31"),
      mkRow(1, 1520, 1540, "2026-08-30"),
    ];
    expect(computeStreaks(rows).current).toEqual({ kind: "losses", count: 2 });
  });

  it("computes best win streak historically", () => {
    const rows = [
      mkRow(2, 1500, 1490, "2026-09-01"),
      mkRow(1, 1470, 1500, "2026-08-31"),
      mkRow(1, 1450, 1470, "2026-08-30"),
      mkRow(1, 1430, 1450, "2026-08-29"),
      mkRow(2, 1450, 1430, "2026-08-28"),
    ];
    expect(computeStreaks(rows).best).toBe(3);
  });

  it("ignores non-confirmed matches", () => {
    const rows = [
      { ...mkRow(1, 1500, 1520, "2026-09-01"), matches: { status: "pending_attestation", match_players: [] } },
      mkRow(2, 1520, 1500, "2026-08-31"),
    ];
    expect(computeStreaks(rows).current.kind).toBe("losses");
  });
});

describe("aggregateEloSeries", () => {
  it("returns points unchanged when count <= 100", () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      elo_after: 1500 + i,
      created_at: new Date(2026, 0, i + 1).toISOString(),
    }));
    const s = aggregateEloSeries(rows, "all");
    expect(s.length).toBe(50);
  });

  it("aggregates by day when count > 100 and range=all", () => {
    const day1 = "2026-01-01T10:00:00Z";
    const day1b = "2026-01-01T20:00:00Z";
    const day2 = "2026-01-02T10:00:00Z";
    const rows = [
      { elo_after: 1500, created_at: day1 },
      { elo_after: 1510, created_at: day1b },
      { elo_after: 1520, created_at: day2 },
      ...Array.from({ length: 120 }, (_, i) => ({
        elo_after: 1500 + i,
        created_at: new Date(2026, 5, i + 1).toISOString(),
      })),
    ];
    const s = aggregateEloSeries(rows, "all");
    const uniqueDays = new Set(s.map((p) => p.day));
    expect(s.length).toBe(uniqueDays.size);
    const jan1 = s.find((p) => p.day === "2026-01-01");
    expect(jan1?.elo).toBe(1510);
  });

  it("slices last N for range=10 / range=50", () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      elo_after: 1500 + i,
      created_at: new Date(2026, 0, i + 1).toISOString(),
    }));
    expect(aggregateEloSeries(rows, "last10").length).toBe(10);
    expect(aggregateEloSeries(rows, "last50").length).toBe(50);
  });
});

describe("computePartnerRivalStats", () => {
  const partnerRow = (partnerId: string, myWon: boolean) => ({
    rank: myWon ? 1 : 2,
    team: 1,
    matches: {
      status: "confirmed" as const,
      match_players: [
        { team: 1, user_id: "me", score: 0, profiles: null },
        { team: 1, user_id: partnerId, score: 0, profiles: { username: partnerId, display_name: partnerId } },
        { team: 2, user_id: "rival", score: 0, profiles: { username: "rival", display_name: "Rival" } },
      ],
    },
  });

  it("requires min 2 games for partner", () => {
    const rows = [partnerRow("bob", true)];
    const { favoritePartner } = computePartnerRivalStats(rows, "me");
    expect(favoritePartner).toBeNull();
  });

  it("picks partner with most games", () => {
    const rows = [
      partnerRow("bob", true),
      partnerRow("bob", true),
      partnerRow("alice", false),
      partnerRow("alice", true),
    ];
    const { favoritePartner } = computePartnerRivalStats(rows, "me");
    expect(favoritePartner?.name).toBe("bob");
    expect(favoritePartner?.games).toBe(2);
    expect(favoritePartner?.wins).toBe(2);
  });
});

describe("computeHeadToHead", () => {
  const h2hRow = (myTeam: 1 | 2, theirTeam: 1 | 2, myWon: boolean, meScore: number, themScore: number) => ({
    rank: myWon ? 1 : 2,
    team: myTeam,
    matches: {
      status: "confirmed" as const,
      match_players: [
        { team: myTeam, user_id: "me", score: meScore, profiles: null },
        { team: theirTeam, user_id: "them", score: themScore, profiles: { username: "them", display_name: "Them" } },
      ],
    },
  });

  it("counts opposing-team matches as vs", () => {
    const rows = [
      h2hRow(1, 2, true, 200, 100),
      h2hRow(1, 2, false, 100, 200),
      h2hRow(2, 1, true, 200, 100),
    ];
    const r = computeHeadToHead(rows, "me", "them");
    expect(r.vs.games).toBe(3);
    expect(r.vs.my_wins).toBe(2);
    expect(r.vs.their_wins).toBe(1);
  });

  it("counts same-team matches as together", () => {
    const rows = [
      h2hRow(1, 1, true, 200, 200),
      h2hRow(2, 2, false, 100, 100),
    ];
    const r = computeHeadToHead(rows, "me", "them");
    expect(r.together.games).toBe(2);
    expect(r.together.wins).toBe(1);
    expect(r.together.losses).toBe(1);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `pnpm vitest run src/lib/__tests__/profile-stats.test.ts`
Expected: FAIL — Cannot find module '../profile-stats'.

- [ ] **Step 3: Implementar `src/lib/profile-stats.ts`**

Crear `src/lib/profile-stats.ts`:

```ts
/**
 * Server-side aggregation helpers for the profile page.
 * All functions are pure — they accept raw rows and return computed shapes.
 */

export type MatchStatus = "confirmed" | "pending_attestation" | "disputed" | "void";

export type HistoryRow = {
  rank: number;
  team: number;
  elo_before?: number | null;
  elo_after?: number | null;
  created_at: string;
  matches: {
    status: MatchStatus;
    match_players: Array<{
      team: number;
      user_id: string;
      score: number;
      profiles: { username: string; display_name: string | null } | null;
    }>;
  } | null;
};

export type EloPoint = {
  elo: number;
  day: string;            // YYYY-MM-DD
  timestamp: number;      // ms since epoch for x-axis
};

export type EloRow = { elo_after: number | null; created_at: string };

export type StreakResult = {
  current: { kind: "wins" | "losses" | "none"; count: number };
  best: number;
};

export type PartnerRivalStats = {
  favoritePartner: { userId: string; username: string; name: string; games: number; wins: number; losses: number } | null;
  toughestRival:   { userId: string; username: string; name: string; games: number; my_wins: number; my_losses: number } | null;
};

export type H2HResult = {
  vs:       { games: number; my_wins: number; their_wins: number };
  together: { games: number; wins: number; losses: number };
};

export type EloRange = "last10" | "last50" | "all";

const isConfirmed = (r: HistoryRow) => r.matches?.status === "confirmed";

/**
 * Compute current and best streaks from confirmed history (most-recent first).
 */
export function computeStreaks(rows: HistoryRow[]): StreakResult {
  const confirmed = rows.filter(isConfirmed);
  if (confirmed.length === 0) return { current: { kind: "none", count: 0 }, best: 0 };

  const firstWon = confirmed[0].rank === 1;
  let current: StreakResult["current"] = { kind: firstWon ? "wins" : "losses", count: 1 };
  for (let i = 1; i < confirmed.length; i++) {
    const won = confirmed[i].rank === 1;
    if ((current.kind === "wins" && won) || (current.kind === "losses" && !won)) {
      current.count += 1;
    } else {
      break;
    }
  }

  let best = 0;
  let run = 0;
  for (const r of confirmed) {
    if (r.rank === 1) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { current, best };
}

/**
 * Aggregate an Elo series with day-collapse when >100 points and range="all".
 * Input rows expected in descending chronological order.
 */
export function aggregateEloSeries(rows: EloRow[], range: EloRange): EloPoint[] {
  const sorted = [...rows]
    .filter((r) => Number.isFinite(Number(r.elo_after)))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (range === "last10") return sorted.slice(-10).map(toPoint);
  if (range === "last50") return sorted.slice(-50).map(toPoint);

  if (sorted.length <= 100) return sorted.map(toPoint);

  // Aggregate by day (keep last elo_after of each day)
  const byDay = new Map<string, EloPoint>();
  for (const r of sorted) {
    const d = r.created_at.slice(0, 10); // YYYY-MM-DD
    byDay.set(d, {
      elo: Number(r.elo_after),
      day: d,
      timestamp: new Date(r.created_at).getTime(),
    });
  }
  return [...byDay.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function toPoint(r: EloRow): EloPoint {
  return {
    elo: Number(r.elo_after),
    day: r.created_at.slice(0, 10),
    timestamp: new Date(r.created_at).getTime(),
  };
}

/**
 * Compute favorite partner + toughest rival from history rows (min 2 games each).
 */
export function computePartnerRivalStats(rows: HistoryRow[], myUserId: string): PartnerRivalStats {
  const partnerStats = new Map<string, { userId: string; username: string; name: string; games: number; wins: number; losses: number }>();
  const rivalStats   = new Map<string, { userId: string; username: string; name: string; games: number; my_wins: number; my_losses: number }>();

  for (const r of rows) {
    if (!isConfirmed(r)) continue;
    const myTeam = r.team;
    const won = r.rank === 1;
    const players = r.matches?.match_players ?? [];
    for (const mp of players) {
      if (mp.user_id === myUserId) continue;
      const name = mp.profiles?.display_name?.split(" ")[0] ?? mp.profiles?.username ?? "?";
      const username = mp.profiles?.username ?? mp.user_id;
      if (mp.team === myTeam) {
        const cur = partnerStats.get(mp.user_id) ?? { userId: mp.user_id, username, name, games: 0, wins: 0, losses: 0 };
        cur.games += 1;
        if (won) cur.wins += 1; else cur.losses += 1;
        partnerStats.set(mp.user_id, cur);
      } else {
        const cur = rivalStats.get(mp.user_id) ?? { userId: mp.user_id, username, name, games: 0, my_wins: 0, my_losses: 0 };
        cur.games += 1;
        if (won) cur.my_wins += 1; else cur.my_losses += 1;
        rivalStats.set(mp.user_id, cur);
      }
    }
  }

  const favoritePartner = [...partnerStats.values()]
    .filter((s) => s.games >= 2)
    .sort((a, b) => b.games - a.games || b.wins - a.wins)[0] ?? null;

  const toughestRival = [...rivalStats.values()]
    .filter((s) => s.games >= 2)
    .sort((a, b) => b.my_losses - a.my_losses || b.games - a.games)[0] ?? null;

  return { favoritePartner, toughestRival };
}

/**
 * Head-to-head between me and target: matches where both appear, split into
 * `vs` (opposing teams) and `together` (same team).
 */
export function computeHeadToHead(rows: HistoryRow[], myUserId: string, targetUserId: string): H2HResult {
  let vsGames = 0, myWins = 0, theirWins = 0;
  let togetherGames = 0, togetherWins = 0, togetherLosses = 0;

  for (const r of rows) {
    if (!isConfirmed(r)) continue;
    const players = r.matches?.match_players ?? [];
    const target = players.find((mp) => mp.user_id === targetUserId);
    if (!target) continue;

    const won = r.rank === 1;
    if (target.team === r.team) {
      togetherGames += 1;
      if (won) togetherWins += 1; else togetherLosses += 1;
    } else {
      vsGames += 1;
      if (won) myWins += 1; else theirWins += 1;
    }
  }

  return {
    vs:       { games: vsGames, my_wins: myWins, their_wins: theirWins },
    together: { games: togetherGames, wins: togetherWins, losses: togetherLosses },
  };
}

/**
 * Bucket days into last-12-weeks heatmap (7×12 grid). Returns an array of 84
 * cells ordered oldest-to-newest, each with { day: YYYY-MM-DD, count }.
 */
export type HeatmapCell = { day: string; date: Date; count: number };

export function buildHeatmap(rows: HistoryRow[], now: Date = new Date()): HeatmapCell[] {
  const confirmed = rows.filter(isConfirmed);
  const countsByDay = new Map<string, number>();
  for (const r of confirmed) {
    const d = r.created_at.slice(0, 10);
    countsByDay.set(d, (countsByDay.get(d) ?? 0) + 1);
  }

  // Build 84 cells ending today
  const cells: HeatmapCell[] = [];
  const endDate = new Date(now);
  endDate.setHours(0, 0, 0, 0);
  for (let i = 83; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ day: key, date: d, count: countsByDay.get(key) ?? 0 });
  }
  return cells;
}

/**
 * Form strip: last N (default 10) confirmed matches as W/L chips, oldest→newest.
 */
export type FormChip = "W" | "L";

export function buildFormStrip(rows: HistoryRow[], n = 10): FormChip[] {
  return rows
    .filter(isConfirmed)
    .slice(0, n)
    .reverse()
    .map((r) => (r.rank === 1 ? "W" : "L"));
}
```

- [ ] **Step 4: Correr tests para verificar que pasan**

Run: `pnpm vitest run src/lib/__tests__/profile-stats.test.ts`
Expected: PASS, 4 describe blocks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-stats.ts src/lib/__tests__/profile-stats.test.ts
git commit -m "feat(profile): extract server-side aggregation helpers

Adds pure functions for streaks, elo series aggregation (day-collapse
above 100 points), partner/rival stats, head-to-head, heatmap cells,
and form strip. Fully unit-tested."
```

---

## Task 3: Refactorizar `page.tsx` para consumir helpers (sin cambio de UI)

**Files:**
- Modify: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: Refactor mantiendo la UI actual**

Reemplazar el bloque de agregación inline (líneas 60-124) por llamadas a los helpers. Cambios clave:

```tsx
// Añadir al top con los otros imports:
import { computePartnerRivalStats, type HistoryRow } from "@/lib/profile-stats";

// ... dentro del try/catch de history:
const allRows = ((historyRaw ?? []) as any[]).filter((r) => {
  const st = r.matches?.status;
  if (isOwnProfile) return ["confirmed","pending_attestation","disputed","void"].includes(st);
  return st === "confirmed";
}) as HistoryRow[];

history = allRows.slice(0, 20);

const { favoritePartner: fp, toughestRival: tr } = computePartnerRivalStats(allRows, p.id);
favoritePartner = fp ? { name: fp.name, games: fp.games, wins: fp.wins, losses: fp.losses } : null;
toughestRival   = tr ? { name: tr.name, games: tr.games, my_wins: tr.my_wins, my_losses: tr.my_losses } : null;
```

Eliminar el código inline de `partnerStats`/`rivalStats` (líneas 86-121 originales). La UI abajo sigue idéntica.

- [ ] **Step 2: Correr typecheck y tests**

Run: `pnpm typecheck && pnpm vitest run`
Expected: PASS.

- [ ] **Step 3: Verificar visualmente**

Correr `pnpm dev`, ir a `/profile/<username-existente>`, comprobar que la página se ve idéntica a antes.

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/[username]/page.tsx
git commit -m "refactor(profile): consume partner/rival helpers from profile-stats

Pure refactor — no UI change. Removes inline aggregation from the
server component in favor of computePartnerRivalStats. Enables PR2
to plug in more sections without more inline logic."
```

- [ ] **Step 5: Abrir PR 1**

```bash
git push -u origin <branch-name>
gh pr create --title "fix(profile): 404 + extract stats helpers" --body "$(cat <<'EOF'
## Summary
- Fixes the 404 on the Perfil tab by adding `/profile/page.tsx` that redirects logged-in users to their own profile
- Extracts partner/rival/streak/H2H/heatmap logic into `src/lib/profile-stats.ts` (pure functions, fully tested)
- No visual change to `/profile/[username]`

## Test plan
- [ ] Tap Perfil tab while logged-in → opens own profile, not 404
- [ ] Tap Perfil tab logged-out → redirects to `/login?redirectTo=/profile`
- [ ] `/profile/<known-user>` renders identically to prior version
- [ ] `pnpm vitest run src/lib/__tests__/profile-stats.test.ts` green
EOF
)"
```

---

# PR 2 — Charts + Nueva estructura

**Objetivo:** Nueva UI vertical con curva de Elo, stat-tiles, win rate anillo, heatmap, rachas, privacidad gateada. Sin H2H ni mini-ranking amigos (van en PR 3).

## Task 4: `LineChart` para curva de Elo

**Files:**
- Create: `src/components/charts/LineChart.tsx`

- [ ] **Step 1: Implementar el componente**

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";

type Point = { x: number; y: number; label?: string };

type Props = {
  points: Point[];
  height?: number;
  ariaLabel: string;
  peak?: Point | null;
  color?: string;
};

/**
 * SVG line chart with path-draw animation. Responsive width (100%), fixed height.
 * All numeric scaling is done internally; caller passes raw x/y pairs.
 */
export function LineChart({ points, height = 180, ariaLabel, peak = null, color = "#10b981" }: Props) {
  const reduced = useReducedMotion();
  if (points.length < 2) {
    return (
      <div className="text-text-mute text-sm py-8 text-center" role="img" aria-label={ariaLabel}>
        Aún no hay suficientes partidas para dibujar la curva.
      </div>
    );
  }

  const W = 600, H = height, padL = 8, padR = 8, padT = 12, padB = 24;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const px = (x: number) => padL + ((x - minX) / spanX) * (W - padL - padR);
  const py = (y: number) => padT + (1 - (y - minY) / spanY) * (H - padT - padB);

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const peakPos = peak ? { cx: px(peak.x), cy: py(peak.y) } : null;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" role="img" aria-label={ariaLabel} style={{ height }}>
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeOpacity={0.1} />
        <motion.path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: "easeOut" }}
        />
        <motion.circle
          cx={px(last.x)}
          cy={py(last.y)}
          r={5}
          fill={color}
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduced ? 0 : 0.9, duration: 0.2 }}
        />
        {peakPos && (
          <>
            <circle cx={peakPos.cx} cy={peakPos.cy} r={4} fill="none" stroke="#fbbf24" strokeWidth={2} />
            <text x={peakPos.cx} y={Math.max(padT + 8, peakPos.cy - 8)} textAnchor="middle" fontSize={11} fill="#fbbf24">
              {peak!.label ?? `pico ${peak!.y.toFixed(0)}`}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/LineChart.tsx
git commit -m "feat(charts): add LineChart with path-draw animation"
```

---

## Task 5: `RingStat` (anillo para win rate)

**Files:**
- Create: `src/components/charts/RingStat.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  value: number;      // 0..100
  label: string;
  sublabel?: string;
  size?: number;
  ariaLabel: string;
};

export function RingStat({ value, label, sublabel, size = 140, ariaLabel }: Props) {
  const reduced = useReducedMotion();
  const clamp = Math.max(0, Math.min(100, value));
  const stroke = 12;
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  const offset = C * (1 - clamp / 100);

  return (
    <div className="inline-flex flex-col items-center" role="img" aria-label={ariaLabel}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={stroke} />
        <motion.circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="#10b981" strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          strokeDasharray={C}
          initial={reduced ? { strokeDashoffset: offset } : { strokeDashoffset: C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0 : 0.8, ease: "easeOut" }}
        />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="fill-current" fontSize={size * 0.25} fontWeight={700}>
          {clamp.toFixed(0)}%
        </text>
      </svg>
      <div className="mt-2 text-center">
        <div className="text-sm font-semibold">{label}</div>
        {sublabel && <div className="text-xs text-text-mute mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/RingStat.tsx
git commit -m "feat(charts): add RingStat donut for win rate"
```

---

## Task 6: `BarStat` (barra para efectividad)

**Files:**
- Create: `src/components/charts/BarStat.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";

type Props = {
  value: number;      // 0..100
  label: string;
  sublabel?: string;
  ariaLabel: string;
};

export function BarStat({ value, label, sublabel, ariaLabel }: Props) {
  const reduced = useReducedMotion();
  const clamp = Math.max(0, Math.min(100, value));

  return (
    <div className="w-full" role="img" aria-label={ariaLabel}>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-lg font-mono font-bold tabular-nums">{clamp.toFixed(1)}%</span>
      </div>
      <div className="h-3 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={reduced ? { width: `${clamp}%` } : { width: 0 }}
          animate={{ width: `${clamp}%` }}
          transition={{ duration: reduced ? 0 : 0.7, ease: "easeOut" }}
        />
      </div>
      {sublabel && <div className="text-xs text-text-mute mt-1">{sublabel}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/BarStat.tsx
git commit -m "feat(charts): add BarStat progress bar"
```

---

## Task 7: `ActivityHeatmap`

**Files:**
- Create: `src/components/charts/ActivityHeatmap.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import type { HeatmapCell } from "@/lib/profile-stats";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

type Props = {
  cells: HeatmapCell[];    // 84 cells (12 weeks × 7 days), oldest→newest
  ariaLabel: string;
};

/**
 * GitHub-style heatmap: 7 rows (day of week Sun-Sat) × 12 columns (weeks).
 */
export function ActivityHeatmap({ cells, ariaLabel }: Props) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<HeatmapCell | null>(null);

  const max = Math.max(1, ...cells.map(c => c.count));
  const intensity = (c: number) => {
    if (c === 0) return "bg-white/5";
    const ratio = c / max;
    if (ratio > 0.75) return "bg-primary";
    if (ratio > 0.5)  return "bg-primary/70";
    if (ratio > 0.25) return "bg-primary/45";
    return "bg-primary/25";
  };

  // Arrange as 12 columns of 7 (grid-cols-12)
  const cols: HeatmapCell[][] = [];
  for (let c = 0; c < 12; c++) cols.push(cells.slice(c * 7, c * 7 + 7));

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="grid grid-cols-12 gap-1">
        {cols.map((col, ci) => (
          <div key={ci} className="grid grid-rows-7 gap-1">
            {col.map((cell, ri) => (
              <motion.button
                key={`${ci}-${ri}`}
                type="button"
                className={`aspect-square rounded-sm ${intensity(cell.count)}`}
                initial={reduced ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : (ci * 7 + ri) * 0.005 }}
                onFocus={() => setHover(cell)}
                onBlur={() => setHover(null)}
                onMouseEnter={() => setHover(cell)}
                onMouseLeave={() => setHover(null)}
                onTouchStart={() => setHover(cell)}
                aria-label={`${cell.day}: ${cell.count} partidas`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="text-xs text-text-mute mt-2 h-5">
        {hover ? `${hover.count} ${hover.count === 1 ? "partida" : "partidas"} · ${new Date(hover.day).toLocaleDateString("es", { day: "numeric", month: "short" })}` : "Últimas 12 semanas"}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/ActivityHeatmap.tsx
git commit -m "feat(charts): add ActivityHeatmap (GitHub-style 12wks)"
```

---

## Task 8: `FormStrip`

**Files:**
- Create: `src/components/charts/FormStrip.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import type { FormChip } from "@/lib/profile-stats";
import { motion, useReducedMotion } from "framer-motion";

export function FormStrip({ chips, ariaLabel }: { chips: FormChip[]; ariaLabel: string }) {
  const reduced = useReducedMotion();
  if (chips.length === 0) {
    return <div className="text-text-mute text-sm" role="img" aria-label={ariaLabel}>Sin partidas recientes.</div>;
  }
  return (
    <div className="flex gap-1.5" role="img" aria-label={ariaLabel}>
      {chips.map((c, i) => (
        <motion.span
          key={i}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-md font-mono font-bold text-sm ${c === "W" ? "bg-primary/20 text-primary" : "bg-danger/20 text-danger"}`}
          initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.25, delay: reduced ? 0 : i * 0.05 }}
        >
          {c === "W" ? "V" : "D"}
        </motion.span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/FormStrip.tsx
git commit -m "feat(charts): add FormStrip V/D chips"
```

---

## Task 9: Sección cliente `EloCurveSection` (con selector de rango)

**Files:**
- Create: `src/components/profile/EloCurveSection.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import { useMemo, useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import type { EloPoint } from "@/lib/profile-stats";

type Range = "10" | "50" | "all";

export function EloCurveSection({
  points,     // full series computed server-side with range="all"
  points50,   // last 50
  points10,   // last 10
}: {
  points: EloPoint[];
  points50: EloPoint[];
  points10: EloPoint[];
}) {
  const [range, setRange] = useState<Range>("50");
  const active = range === "10" ? points10 : range === "50" ? points50 : points;

  const chartPoints = useMemo(() => active.map((p) => ({ x: p.timestamp, y: p.elo })), [active]);
  const peak = useMemo(() => {
    if (active.length === 0) return null;
    const top = active.reduce((a, b) => (b.elo > a.elo ? b : a));
    return { x: top.timestamp, y: top.elo, label: `${top.elo.toFixed(0)}` };
  }, [active]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Evolución de DomiRank</h2>
        <div className="inline-flex rounded-full bg-white/5 p-1 text-xs">
          {(["10", "50", "all"] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-full transition-colors ${range === r ? "bg-primary text-black font-semibold" : "text-text-mute"}`}
            >
              {r === "all" ? "Todas" : r}
            </button>
          ))}
        </div>
      </div>
      <LineChart
        points={chartPoints}
        peak={peak}
        ariaLabel={`Curva de DomiRank últimos ${range === "all" ? "todos" : range} partidas`}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/profile/EloCurveSection.tsx
git commit -m "feat(profile): add EloCurveSection with 10/50/All selector"
```

---

## Task 10: `StatTiles` server component

**Files:**
- Create: `src/components/profile/StatTiles.tsx`

- [ ] **Step 1: Implementar**

```tsx
type Tile = { value: string; label: string };

export function StatTiles({
  games, winRate, effectiveness, bestStreak,
}: {
  games: number; winRate: number; effectiveness: number; bestStreak: number;
}) {
  const tiles: Tile[] = [
    { value: String(games), label: "Partidas" },
    { value: `${winRate.toFixed(0)}%`, label: "Win rate" },
    { value: `${effectiveness.toFixed(0)}%`, label: "Efectividad" },
    { value: bestStreak > 0 ? `${bestStreak}` : "—", label: "Mejor racha" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <div key={t.label} className="card py-3 text-center">
          <div className="text-2xl font-mono font-bold tabular-nums">{t.value}</div>
          <div className="text-xs text-text-mute mt-1 uppercase tracking-wide">{t.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/profile/StatTiles.tsx
git commit -m "feat(profile): add StatTiles row"
```

---

## Task 11: `StreaksSection`

**Files:**
- Create: `src/components/profile/StreaksSection.tsx`

- [ ] **Step 1: Implementar**

```tsx
import type { StreakResult, FormChip, HeatmapCell } from "@/lib/profile-stats";
import { FormStrip } from "@/components/charts/FormStrip";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";

export function StreaksSection({
  streaks, form, heatmap,
}: {
  streaks: StreakResult; form: FormChip[]; heatmap: HeatmapCell[];
}) {
  const currentBadge = (() => {
    const { kind, count } = streaks.current;
    if (kind === "none" || count < 2) return null;
    if (kind === "wins")   return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-sm font-semibold">🔥 {count} victorias seguidas</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-text-mute text-sm font-semibold">Racha: {count} derrotas</span>;
  })();

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Actividad</h2>
        {currentBadge}
      </div>
      <ActivityHeatmap cells={heatmap} ariaLabel="Heatmap de actividad últimas 12 semanas" />
      <div>
        <div className="text-xs text-text-mute uppercase tracking-wide mb-2">Forma reciente</div>
        <FormStrip chips={form} ariaLabel="Últimas 10 partidas" />
      </div>
      {streaks.best > 0 && (
        <div className="text-xs text-text-mute">Mejor racha histórica: <span className="text-text font-semibold">{streaks.best} victorias seguidas</span></div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/profile/StreaksSection.tsx
git commit -m "feat(profile): add StreaksSection (heatmap + form + current streak)"
```

---

## Task 12: `HistoryList` (client con botón "Ver más")

**Files:**
- Create: `src/components/profile/HistoryList.tsx`

- [ ] **Step 1: Implementar**

Extraer el bloque de historial actual (líneas ~269-344 del `page.tsx` original) a un componente cliente que reciba las 50 filas y muestre 10 inicialmente + botón para expandir.

```tsx
"use client";
import Link from "next/link";
import { useState } from "react";

type Row = any; // reuse the shape used in page.tsx today

export function HistoryList({ rows }: { rows: Row[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, 10);

  if (rows.length === 0) {
    return <p className="text-text-mute">Aún no ha jugado partidas.</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {visible.map((r) => (
          <HistoryRow key={`${r.match_id}-${r.team}`} row={r} />
        ))}
      </ul>
      {!expanded && rows.length > 10 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full text-sm text-primary hover:underline"
        >
          Ver más ({rows.length - 10})
        </button>
      )}
    </>
  );
}

function HistoryRow({ row: r }: { row: Row }) {
  const status = r.matches?.status as string | undefined;
  const isConfirmed = status === "confirmed";
  const isPending   = status === "pending_attestation";
  const isDisputed  = status === "disputed";
  const isVoid      = status === "void";
  const won = r.rank === 1;
  const hasRating = r.elo_before != null && r.elo_after != null;
  const delta = hasRating ? Number(r.elo_after) - Number(r.elo_before) : null;

  const mps = (r.matches?.match_players ?? []) as Array<{
    team: number; user_id: string; score: number;
    profiles: { username: string; display_name: string | null } | null;
  }>;
  const firstNameOf = (mp: typeof mps[0]) =>
    (mp.profiles?.display_name?.split(" ")[0]) ?? mp.profiles?.username ?? "?";
  const teamA = mps.filter((mp) => mp.team === 1);
  const teamB = mps.filter((mp) => mp.team === 2);
  const nameA = teamA.map(firstNameOf).join(" & ");
  const nameB = teamB.map(firstNameOf).join(" & ");
  const scoreA = teamA.reduce((s, mp) => s + (mp.score ?? 0), 0);
  const scoreB = teamB.reduce((s, mp) => s + (mp.score ?? 0), 0);
  const hasScore = scoreA > 0 || scoreB > 0;
  const winnerSide: "A" | "B" | null = !hasScore ? null : scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : null;
  const myTeamWon = r.team === 1 ? scoreA > scoreB : scoreB > scoreA;

  return (
    <li className="py-3">
      <Link href={`/matches/${r.match_id}`} className="block hover:bg-surface-2 -mx-2 px-2 py-1 rounded transition-colors">
        <div className="flex items-center gap-2 text-sm">
          <span className={`flex-1 truncate ${winnerSide === "A" ? "font-bold text-primary" : "text-text"}`}>{nameA || "?"}</span>
          {hasScore ? (
            <span className="font-mono tabular-nums shrink-0">
              <span className={winnerSide === "A" ? "text-primary font-bold" : ""}>{scoreA}</span>
              <span className="opacity-30 mx-1">—</span>
              <span className={winnerSide === "B" ? "text-primary font-bold" : ""}>{scoreB}</span>
            </span>
          ) : (
            <span className="text-text-mute text-xs shrink-0">vs</span>
          )}
          <span className={`flex-1 truncate text-right ${winnerSide === "B" ? "font-bold text-primary" : "text-text"}`}>{nameB || "?"}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-text-mute">
          <span>{new Date(r.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}</span>
          <span className="opacity-50">·</span>
          <span>Parejas · {r.matches?.target_points} pts</span>
          {isPending && <span className="badge bg-yellow-400/15 text-yellow-400 ml-auto">Pendiente</span>}
          {isDisputed && <span className="badge bg-danger/15 text-danger ml-auto">Disputa</span>}
          {isVoid && <span className="badge bg-surface-3 text-text-mute ml-auto">Anulada</span>}
          {isConfirmed && hasRating && (
            <>
              <span className={`badge ml-auto ${myTeamWon ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"}`}>
                {won ? "Ganó" : "Perdió"}
              </span>
              <span className={`font-mono ${delta! >= 0 ? "text-primary" : "text-danger"}`}>
                {delta! >= 0 ? "+" : ""}{delta!}
              </span>
            </>
          )}
        </div>
      </Link>
    </li>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/profile/HistoryList.tsx
git commit -m "feat(profile): extract HistoryList with Ver más toggle (10→50)"
```

---

## Task 13: Refactor `page.tsx` — nueva estructura + privacidad + query paralela

**Files:**
- Modify: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: Añadir query paralela para serie Elo**

Insertar antes del `try/catch` de historial:

```ts
const [historyRes, eloRes] = await Promise.all([
  supabase
    .from("match_players")
    .select(`
      match_id, team, rank, elo_before, elo_after, created_at,
      matches(
        id, format, target_points, status,
        match_players(team, user_id, score, profiles(username, display_name))
      )
    `)
    .eq("user_id", p.id)
    .order("created_at", { ascending: false })
    .limit(50),
  supabase
    .from("match_players")
    .select(`elo_after, created_at, matches!inner(status)`)
    .eq("user_id", p.id)
    .eq("matches.status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(200),
]);
```

Y reemplazar el fetch actual de `historyRaw` por `historyRes.data`.

- [ ] **Step 2: Computar todos los agregados con helpers**

Después del filtrado a `allRows`:

```ts
import { computeStreaks, aggregateEloSeries, computePartnerRivalStats, buildHeatmap, buildFormStrip, type EloRow } from "@/lib/profile-stats";

const streaks = computeStreaks(allRows);
const heatmap = buildHeatmap(allRows);
const form    = buildFormStrip(allRows, 10);

const eloRaw = (eloRes.data ?? []) as EloRow[];
const eloAll  = aggregateEloSeries(eloRaw, "all");
const eloLast50 = aggregateEloSeries(eloRaw, "last50");
const eloLast10 = aggregateEloSeries(eloRaw, "last10");

const { favoritePartner: fp, toughestRival: tr } = computePartnerRivalStats(allRows, p.id);
```

- [ ] **Step 3: Aplicar gating de privacidad**

Añadir después de calcular `isOwnProfile` y `relation`:

```ts
const canSeeDetail = isOwnProfile || relation.kind === "friends";
```

- [ ] **Step 4: Renderizar la nueva estructura**

Reemplazar el JSX bajo `SecondaryPageShell`. Orden:

1. **Header de identidad + DomiRank** (mantener bloque actual líneas 132-233).
2. **Stat-tiles** — siempre visible si `total_games >= 1`.
3. **Curva Elo** — solo si `canSeeDetail && p.total_games >= 5 && eloAll.length >= 2`.
4. **Win rate + Efectividad** — anillo + barra, siempre visible si `total_games >= 1`.
5. **Actividad + Rachas** — solo si `canSeeDetail && p.total_games >= 5`.
6. **Pareja favorita + Rival** — siempre visible cuando exista data (públicos por decisión).
7. **Historial** — completo si `canSeeDetail`; caso contrario oculto.
8. **Gate CTA** — si `!canSeeDetail`, mostrar card "Hazte amigo de {nombre} para ver sus estadísticas completas" con `FriendActionButton`.
9. **CTA novato 0 partidas propio** — si `isOwnProfile && p.total_games === 0`, mostrar una única card "Juega tu primera partida" con link al wizard, y ocultar todo lo demás excepto el header.

Extracto clave del nuevo JSX (después del header/DomiRank + ModalityCard grid):

```tsx
{p.total_games >= 1 && (
  <StatTiles
    games={p.total_games ?? 0}
    winRate={Number(p.win_rate ?? 0) * 100}
    effectiveness={Number(p.effectiveness ?? 0) * 100}
    bestStreak={streaks.best}
  />
)}

{canSeeDetail && p.total_games >= 5 && eloAll.length >= 2 && (
  <EloCurveSection points={eloAll} points50={eloLast50} points10={eloLast10} />
)}

{p.total_games >= 1 && (
  <div className="card">
    <h2 className="text-xl font-semibold mb-4">Rendimiento global</h2>
    <div className="flex flex-col md:flex-row md:items-center gap-6">
      <RingStat
        value={Number(p.win_rate ?? 0) * 100}
        label="Win rate"
        sublabel={`${p.wins ?? 0}V - ${p.losses ?? 0}D`}
        ariaLabel={`Win rate ${(Number(p.win_rate ?? 0) * 100).toFixed(0)} por ciento`}
      />
      <div className="flex-1">
        <BarStat
          value={Number(p.effectiveness ?? 0) * 100}
          label="Efectividad"
          sublabel={`${Number(p.points_for ?? 0)} puntos a favor / ${Number(p.points_against ?? 0)} en contra`}
          ariaLabel="Efectividad"
        />
      </div>
    </div>
  </div>
)}

{canSeeDetail && p.total_games >= 5 && (
  <StreaksSection streaks={streaks} form={form} heatmap={heatmap} />
)}

{/* Pareja favorita + Rival — públicos (decisión de producto) */}
{(favoritePartner || toughestRival) && (
  // ... bloque actual sin cambios
)}

{!canSeeDetail && !isOwnProfile && p.total_games >= 1 && (
  <div className="card text-center py-8">
    <h3 className="text-lg font-semibold mb-2">Agrega a {p.display_name || p.username}</h3>
    <p className="text-text-mute text-sm mb-4">Para ver su curva de DomiRank, actividad reciente e historial completo.</p>
    <div className="inline-block">
      <FriendActionButton targetUserId={p.id} targetUsername={p.username} initialStatus={relation} />
    </div>
  </div>
)}

{canSeeDetail && (
  <div className="card">
    <h2 className="text-xl font-semibold mb-3">Historial reciente</h2>
    <HistoryList rows={history} />
  </div>
)}

{isOwnProfile && p.total_games === 0 && (
  <div className="card text-center py-8">
    <h3 className="text-lg font-semibold mb-2">Juega tu primera partida</h3>
    <p className="text-text-mute text-sm mb-4">Registra una partida y empieza a ver tu DomiRank crecer.</p>
    <Link href="/wizard" className="btn btn-primary inline-block">Nueva partida</Link>
  </div>
)}
```

- [ ] **Step 5: Typecheck + tests + smoke**

```bash
pnpm typecheck && pnpm vitest run
```

Correr `pnpm dev` y verificar:
- Perfil propio con ≥5 partidas → todo se ve, curva animada.
- Perfil de otro **amigo** → todo detalle visible.
- Perfil de otro **no-amigo** → header + DomiRank + win rate anillo + pareja/rival + CTA de amistad; **sin** curva, sin heatmap, sin historial.
- Perfil propio con 0 partidas → header + CTA "Juega tu primera partida", nada más.
- Perfil propio con 3 partidas → header + tiles + historial; sin curva/rachas.

- [ ] **Step 6: Commit**

```bash
git add src/app/profile/[username]/page.tsx
git commit -m "feat(profile): new profile layout with charts + privacy gating

- Parallel queries (rich history 50 + light elo series 200)
- StatTiles, EloCurve, RingStat, BarStat, Streaks/Heatmap/Form sections
- Privacy gating: only friends and self see detail (curve, activity,
  history). Partner + rival remain public.
- Newbie thresholds: 0 → CTA only; 1-4 → basic; ≥5 → full."
```

- [ ] **Step 7: Abrir PR 2**

```bash
gh pr create --title "feat(profile): charts + redesigned layout" --body "$(cat <<'EOF'
## Summary
- Adds SVG chart primitives (LineChart, RingStat, BarStat, ActivityHeatmap, FormStrip) with framer-motion, reduced-motion aware
- Redesigned profile page with stat tiles, Elo curve (10/50/All selector, peak marker), win rate ring + effectiveness bar, activity heatmap + form strip + current/best streaks
- Privacy gating: non-friends see only header + rating + win rate + partner/rival + CTA. Friends and self see the full detail.
- Newbie states: 0 → single CTA, 1–4 → basic, ≥5 → full
- History pagination: "Ver más" client-side, 10 → 50 (server already returns 50)
- Two parallel queries (rich 50 + light 200); no new dependencies

## Test plan
- [ ] Own profile ≥5 games: full layout renders
- [ ] Friend profile: full detail visible
- [ ] Non-friend profile: gated CTA replaces detail; partner/rival still shown
- [ ] Own profile 0 games: only header + "Juega tu primera partida"
- [ ] Own profile 3 games: no curve/streaks; tiles + history OK
- [ ] `prefers-reduced-motion` disables path-draw and sweep animations
- [ ] `pnpm typecheck && pnpm vitest run` green
EOF
)"
```

---

# PR 3 — Social (H2H + Mini-ranking amigos)

**Objetivo:** Cerrar la comparación social — H2H en perfil de amigo, mini-ranking amigos en `/leaderboard` con toggle, preview top-5 en tu propio perfil.

## Task 14: Fetch friends server-side + `H2HCard`

**Files:**
- Create: `src/components/profile/H2HCard.tsx`
- Modify: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: Implementar `H2HCard`**

```tsx
import type { H2HResult } from "@/lib/profile-stats";
import { Avatar } from "@/components/Avatar";

type SideStat = { display: number; win_rate: number; effectiveness: number; games: number };

export function H2HCard({
  meName, themName, themAvatarProfile,
  meStat, themStat,
  h2h,
}: {
  meName: string;
  themName: string;
  themAvatarProfile: any;
  meStat: SideStat;
  themStat: SideStat;
  h2h: H2HResult;
}) {
  const rows: Array<{ label: string; me: string; them: string; better: "me" | "them" | null }> = [
    { label: "DomiRank",   me: meStat.display.toFixed(1),                        them: themStat.display.toFixed(1),                        better: meStat.display === themStat.display ? null : meStat.display > themStat.display ? "me" : "them" },
    { label: "Win rate",   me: `${(meStat.win_rate * 100).toFixed(0)}%`,         them: `${(themStat.win_rate * 100).toFixed(0)}%`,         better: meStat.win_rate === themStat.win_rate ? null : meStat.win_rate > themStat.win_rate ? "me" : "them" },
    { label: "Efectividad",me: `${(meStat.effectiveness * 100).toFixed(0)}%`,    them: `${(themStat.effectiveness * 100).toFixed(0)}%`,    better: meStat.effectiveness === themStat.effectiveness ? null : meStat.effectiveness > themStat.effectiveness ? "me" : "them" },
    { label: "Partidas",   me: String(meStat.games),                              them: String(themStat.games),                              better: null },
  ];

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Tú vs {themName}</h2>
      {h2h.vs.games === 0 ? (
        <p className="text-text-mute text-sm">Aún no se han enfrentado en una partida confirmada.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 text-center mb-4">
            <div className="bg-primary/10 rounded-lg py-3">
              <div className="text-3xl font-mono font-bold text-primary">{h2h.vs.my_wins}</div>
              <div className="text-xs text-text-mute uppercase tracking-wide mt-1">Ganaste</div>
            </div>
            <div className="bg-danger/10 rounded-lg py-3">
              <div className="text-3xl font-mono font-bold text-danger">{h2h.vs.their_wins}</div>
              <div className="text-xs text-text-mute uppercase tracking-wide mt-1">Perdiste</div>
            </div>
          </div>
          <div className="text-xs text-text-mute text-center mb-4">Δ DomiRank: <span className="font-mono">{(meStat.display - themStat.display >= 0 ? "+" : "")}{(meStat.display - themStat.display).toFixed(1)}</span></div>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center py-2 text-sm">
                <span className={`flex-1 tabular-nums font-mono text-right ${r.better === "me" ? "text-primary font-bold" : ""}`}>{r.me}</span>
                <span className="w-28 text-center text-xs text-text-mute uppercase tracking-wide">{r.label}</span>
                <span className={`flex-1 tabular-nums font-mono ${r.better === "them" ? "text-primary font-bold" : ""}`}>{r.them}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {h2h.together.games > 0 && (
        <p className="text-xs text-text-mute mt-4">Además, jugaron {h2h.together.games} {h2h.together.games === 1 ? "partida" : "partidas"} juntos: <span className="text-primary">{h2h.together.wins}V</span>-<span className="text-danger">{h2h.together.losses}D</span>.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrar en `page.tsx`**

Añadir al bloque server (dentro del try o después de calcular `canSeeDetail`):

```ts
import { computeHeadToHead } from "@/lib/profile-stats";

let h2hResult: ReturnType<typeof computeHeadToHead> | null = null;
let viewerStat: any = null;
if (!isOwnProfile && canSeeDetail) {
  const { data: { user: viewer } } = await supabase.auth.getUser();
  if (viewer) {
    // Traer historial del viewer que incluya al perfil visto
    const { data: myHistory } = await supabase
      .from("match_players")
      .select(`
        team, rank, created_at,
        matches!inner(status, match_players(team, user_id, score, profiles(username, display_name)))
      `)
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (myHistory) {
      h2hResult = computeHeadToHead(myHistory as any, viewer.id, p.id);
    }
    const { data: viewerProfile } = await supabase
      .from("profile_ratings")
      .select("global_display, win_rate, effectiveness, total_games, display_name, username")
      .eq("id", viewer.id)
      .single();
    viewerStat = viewerProfile;
  }
}
```

Y en el JSX, después de "Pareja favorita + Rival" y antes del historial:

```tsx
{!isOwnProfile && canSeeDetail && h2hResult && viewerStat && (
  <H2HCard
    meName={viewerStat.display_name || viewerStat.username}
    themName={p.display_name || p.username}
    themAvatarProfile={p}
    meStat={{
      display: Number(viewerStat.global_display),
      win_rate: Number(viewerStat.win_rate ?? 0),
      effectiveness: Number(viewerStat.effectiveness ?? 0),
      games: Number(viewerStat.total_games ?? 0),
    }}
    themStat={{
      display: Number(p.global_display),
      win_rate: Number(p.win_rate ?? 0),
      effectiveness: Number(p.effectiveness ?? 0),
      games: Number(p.total_games ?? 0),
    }}
    h2h={h2hResult}
  />
)}
```

- [ ] **Step 3: Smoke test**

Con un usuario A y B que son amigos y tienen partidas cruzadas, `/profile/B` (viewer = A) debe mostrar la card H2H con el record real.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/H2HCard.tsx src/app/profile/[username]/page.tsx
git commit -m "feat(profile): add head-to-head card on friend profiles"
```

---

## Task 15: `FriendsPreview` (top-5 amigos en perfil propio)

**Files:**
- Create: `src/components/profile/FriendsPreview.tsx`
- Modify: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: Implementar el componente**

```tsx
import Link from "next/link";
import { Avatar } from "@/components/Avatar";

type Row = { id: string; username: string; display_name: string | null; avatar_url: string | null; global_display: number; win_rate: number };

export function FriendsPreview({ rows, myId }: { rows: Row[]; myId: string }) {
  if (rows.length === 0) return null;
  const top = rows.slice(0, 5);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Ranking entre amigos</h2>
        <Link href="/leaderboard?scope=friends" className="text-sm text-primary hover:underline">Ver todos →</Link>
      </div>
      <ol className="space-y-2">
        {top.map((r, i) => {
          const isMe = r.id === myId;
          return (
            <li key={r.id} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${isMe ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
              <span className="w-6 text-center text-sm text-text-mute font-mono">{i + 1}</span>
              <Avatar player={r} size={32} />
              <Link href={`/profile/${r.username}`} className="flex-1 min-w-0 truncate text-sm font-semibold hover:underline">
                {r.display_name || r.username}
              </Link>
              <span className="font-mono text-sm tabular-nums">{Number(r.global_display).toFixed(1)}</span>
              <span className="text-xs text-text-mute tabular-nums w-12 text-right">{(Number(r.win_rate) * 100).toFixed(0)}%</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Traer los amigos en server + integrar**

En `page.tsx`, dentro del bloque para perfil propio:

```ts
let friendsRanking: any[] = [];
if (isOwnProfile) {
  const { data: friendships } = await supabase
    .from("friendships")
    .select("friend_id")
    .eq("user_id", p.id);
  const friendIds = (friendships ?? []).map((f: any) => f.friend_id);
  if (friendIds.length > 0) {
    const { data: friendRows } = await supabase
      .from("profile_ratings")
      .select("id, username, display_name, avatar_url, global_display, win_rate")
      .in("id", [...friendIds, p.id])
      .order("global_display", { ascending: false });
    friendsRanking = friendRows ?? [];
  }
}
```

Y en el JSX (después del historial o antes, ubicación a criterio — sugerido justo antes del historial en tu propio perfil):

```tsx
{isOwnProfile && friendsRanking.length > 1 && (
  <FriendsPreview rows={friendsRanking} myId={p.id} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/FriendsPreview.tsx src/app/profile/[username]/page.tsx
git commit -m "feat(profile): add friends top-5 preview on own profile"
```

---

## Task 16: `ScopeToggle` + soporte `?scope=friends` en `/leaderboard`

**Files:**
- Create: `src/components/leaderboard/ScopeToggle.tsx`
- Modify: `src/app/leaderboard/page.tsx`

- [ ] **Step 1: Verificar shape actual del leaderboard**

```bash
head -80 src/app/leaderboard/page.tsx
```

Anotar la query base actual para replicarla con el filtro de amigos.

- [ ] **Step 2: Implementar `ScopeToggle`**

```tsx
"use client";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

export function ScopeToggle({ hasSession }: { hasSession: boolean }) {
  const sp = useSearchParams();
  const path = usePathname();
  const scope = sp.get("scope") === "friends" ? "friends" : "global";

  const linkFor = (target: "global" | "friends") => {
    const params = new URLSearchParams(sp.toString());
    if (target === "global") params.delete("scope");
    else params.set("scope", "friends");
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  return (
    <div className="inline-flex rounded-full bg-white/5 p-1 text-sm">
      <Link href={linkFor("global")} className={`px-4 py-1.5 rounded-full ${scope === "global" ? "bg-primary text-black font-semibold" : "text-text-mute"}`}>
        Global
      </Link>
      {hasSession ? (
        <Link href={linkFor("friends")} className={`px-4 py-1.5 rounded-full ${scope === "friends" ? "bg-primary text-black font-semibold" : "text-text-mute"}`}>
          Amigos
        </Link>
      ) : (
        <Link href="/login?redirectTo=/leaderboard?scope=friends" className="px-4 py-1.5 rounded-full text-text-mute">
          Amigos
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Ajustar `leaderboard/page.tsx`**

Añadir en el server component:

```ts
export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const { scope } = await searchParams;
  const isFriends = scope === "friends";
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from("profile_ratings").select("*").order("global_display", { ascending: false }).limit(100);

  if (isFriends) {
    if (!user) {
      // redirect to login
      redirect("/login?redirectTo=/leaderboard?scope=friends");
    }
    const { data: friendships } = await supabase.from("friendships").select("friend_id").eq("user_id", user.id);
    const friendIds = (friendships ?? []).map((f: any) => f.friend_id);
    query = supabase
      .from("profile_ratings")
      .select("*")
      .in("id", [...friendIds, user.id])
      .order("global_display", { ascending: false });
  }

  const { data: rows } = await query;
  // ... resto del render + <ScopeToggle hasSession={!!user} /> en el header
}
```

Empty state cuando `isFriends && rows.length <= 1`: reemplazar la tabla por card "Aún no tienes amigos aquí. Agrega personas para verlas en tu ranking." con `<Link href="/friends" className="btn btn-primary">Buscar amigos</Link>`. Resaltar la fila del viewer con `bg-primary/10 ring-1 ring-primary/30`.

- [ ] **Step 4: Smoke test**

- `/leaderboard` → global como hoy.
- `/leaderboard?scope=friends` sin amigos → empty state con CTA.
- `/leaderboard?scope=friends` con amigos → tabla filtrada, viewer resaltado.
- Sin sesión + `?scope=friends` → redirect a login.

- [ ] **Step 5: Commit**

```bash
git add src/components/leaderboard/ScopeToggle.tsx src/app/leaderboard/page.tsx
git commit -m "feat(leaderboard): add Global/Amigos scope toggle

- ?scope=friends filters to viewer's friends + self
- ScopeToggle client component reads/writes query param
- Empty state when no friends yet
- Viewer's row highlighted"
```

- [ ] **Step 6: Abrir PR 3**

```bash
gh pr create --title "feat(profile,leaderboard): head-to-head + friends ranking" --body "$(cat <<'EOF'
## Summary
- Head-to-head card on friend profiles: opposing-team record, side-by-side comparison, Δ DomiRank, "juntos" line
- Top-5 friends preview on own profile linking to full ranking
- `/leaderboard?scope=friends` toggle; empty state for no-friends case; viewer row highlighted

## Test plan
- [ ] Friend profile shows H2H with real numbers
- [ ] Own profile shows top-5 friends when ≥1 friend exists
- [ ] `/leaderboard?scope=friends` filters correctly
- [ ] No-friends toggle shows empty state + CTA
- [ ] Non-friend profile: no H2H (already gated by canSeeDetail)
- [ ] Unauth + ?scope=friends → login redirect
EOF
)"
```

---

## Checklist final (spec §7)

- [ ] `pnpm build` / typecheck sin errores nuevos; `pnpm vitest run` verde.
- [ ] Tab Perfil abre tu perfil (no 404); `/profile` redirige; sin sesión → login con redirectTo.
- [ ] Curva Elo con selector 10/50/Todas y pico marcado; path-draw + reduced-motion respetado.
- [ ] Win rate (anillo) + efectividad (barra).
- [ ] Heatmap + form strip + racha actual bidireccional + mejor racha.
- [ ] Pareja favorita + rival como cards (públicos).
- [ ] H2H en perfil de amigo con record real; mini-ranking amigos + toggle en `/leaderboard`.
- [ ] Gating: no-amigo ve público + CTA; amigo ve detalle; propio ve todo.
- [ ] Sin librerías de charts nuevas; agregación server-side, sin N+1.
- [ ] Novato states (0 → CTA, 1-4 → básico, ≥5 → completo).
- [ ] Desktop coherente, safe-area, dark theme.
