"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { RankBadge, goldRingClass } from "@/components/leaderboard/RankBadge";
import { MovementIndicator } from "@/components/leaderboard/MovementIndicator";
import { FormDots } from "@/components/leaderboard/FormDots";
import { StreakChip } from "@/components/leaderboard/StreakChip";
import { ShareTableButton } from "@/components/leaderboard/ShareTableButton";
import { LeaderboardSkeleton } from "@/components/leaderboard/LeaderboardSkeleton";
import { LeaderboardEmpty } from "@/components/leaderboard/LeaderboardEmpty";
import { useTournamentRealtimeStandings } from "@/hooks/useTournamentRealtimeStandings";
import type { LeaderboardProps, LeaderboardRow, SortKey, SortDir } from "@/types/leaderboard";

const HEADER_TOOLTIPS: Record<SortKey, string> = {
  rank:                       "Posición actual",
  wins:                       "Victorias",
  losses:                     "Derrotas",
  win_pct:                    "Porcentaje de victorias",
  effectiveness_coefficient:  "Coeficiente de Eficiencia (federado)",
  pf:                         "Puntos a favor",
  pc:                         "Puntos en contra",
  plus_minus:                 "Diferencial (PF − PC)",
};

export function TournamentLeaderboard({
  tournamentId,
  initialStandings,
  viewerId,
  isOrganizer,
}: LeaderboardProps) {
  const router = useRouter();
  const tableRef = useRef<HTMLDivElement>(null);
  const { standings, loading, lastUpdated } = useTournamentRealtimeStandings(
    tournamentId,
    initialStandings
  );

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  // Trackea qué filas cambiaron de posición para la animación sutil
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const showSearch = standings.length >= 8;

  // Cuando standings cambia (realtime), marca filas con nueva posición
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const newFlash = new Set<string>();
    for (const row of standings) {
      const prev = prevRanksRef.current.get(row.user_id);
      if (prev !== undefined && prev !== row.rank) {
        newFlash.add(row.user_id);
      }
    }
    if (newFlash.size > 0) {
      setFlashIds(newFlash);
      const t = setTimeout(() => setFlashIds(new Set()), 1500);
      return () => clearTimeout(t);
    }
    // Actualiza el mapa de posiciones previas
    prevRanksRef.current = new Map(standings.map((r) => [r.user_id, r.rank]));
  }, [standings]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === "desc") {
        // Tercer click: vuelve a default
        setSortKey("rank");
        setSortDir("asc");
      } else {
        setSortDir("desc");
      }
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  }

  const displayed: LeaderboardRow[] = useMemo(() => {
    let rows = [...standings];

    // Filtro de búsqueda
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.username.toLowerCase().includes(q) ||
          (r.display_name ?? "").toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortKey !== "rank") {
      rows.sort((a, b) => {
        let va = a[sortKey as keyof LeaderboardRow] as number;
        let vb = b[sortKey as keyof LeaderboardRow] as number;
        return sortDir === "asc" ? va - vb : vb - va;
      });
    } else if (sortDir === "desc") {
      rows.sort((a, b) => b.rank - a.rank);
    }

    return rows;
  }, [standings, query, sortKey, sortDir]);

  function highlightName(name: string) {
    const q = query.trim().toLowerCase();
    if (!q) return <span>{name}</span>;
    const idx = name.toLowerCase().indexOf(q);
    if (idx === -1) return <span>{name}</span>;
    return (
      <span>
        {name.slice(0, idx)}
        <mark className="bg-transparent text-primary font-semibold">{name.slice(idx, idx + q.length)}</mark>
        {name.slice(idx + q.length)}
      </span>
    );
  }

  // Encabezado de columna clicable
  function ColHeader({ label, sortable, colKey }: { label: string; sortable?: boolean; colKey?: SortKey }) {
    const tooltip = colKey ? HEADER_TOOLTIPS[colKey] : undefined;
    const isActive = sortable && colKey === sortKey;
    const content = (
      <button
        type="button"
        onClick={sortable && colKey ? () => handleSort(colKey) : undefined}
        className={`flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wider leading-none transition-colors duration-100
          ${sortable ? "cursor-pointer hover:text-text" : "cursor-default"}
          ${isActive ? "text-primary" : "text-text-mute"}`}
        aria-sort={isActive ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
      >
        {label}
        {isActive && (
          <span className="ml-0.5 text-[9px]">{sortDir === "asc" ? "↑" : "↓"}</span>
        )}
      </button>
    );

    if (tooltip) {
      return <Tooltip content={tooltip}>{content}</Tooltip>;
    }
    return content;
  }

  return (
    <section ref={tableRef} className="card p-0 overflow-hidden" data-leaderboard="true">
      {/* Card header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div>
          <h2 className="font-semibold text-text leading-tight">Tabla · Jugadores</h2>
          {lastUpdated && (
            <p className="text-[11px] text-text-mute mt-0.5" aria-live="polite">
              Actualizado hace {getRelativeTime(lastUpdated)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-text-mute border-t-primary animate-spin" aria-label="Cargando" />
          )}
          <ShareTableButton tableRef={tableRef} tournamentName="DomiRank" />
        </div>
      </div>

      {/* Buscador — solo si ≥8 jugadores */}
      {showSearch && (
        <div className="px-4 py-2.5 border-b border-border" data-export-exclude="true">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jugador…"
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-mute focus:outline-none focus:border-primary transition-colors duration-150 min-h-[40px]"
            aria-label="Buscar jugador en la tabla"
          />
        </div>
      )}

      {/* Headers de columnas */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-surface-2/40">
        {/* # sticky */}
        <div className="w-7 shrink-0">
          <ColHeader label="#" sortable colKey="rank" />
        </div>
        {/* Avatar placeholder */}
        <div className="w-7 shrink-0" />
        {/* Jugador */}
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-mute">Jugador</span>
        </div>
        {/* Columnas numéricas — hidden en xs, visibles sm+ */}
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <div className="w-8 text-right"><ColHeader label="V" sortable colKey="wins" /></div>
          <div className="w-8 text-right"><ColHeader label="D" sortable colKey="losses" /></div>
          <div className="w-10 text-right"><ColHeader label="%" sortable colKey="win_pct" /></div>
          <div className="w-12 text-right"><ColHeader label="CE" sortable colKey="effectiveness_coefficient" /></div>
          <div className="w-10 text-right"><ColHeader label="PF" sortable colKey="pf" /></div>
          <div className="w-10 text-right"><ColHeader label="PC" sortable colKey="pc" /></div>
          <div className="w-10 text-right"><ColHeader label="±" sortable colKey="plus_minus" /></div>
        </div>
        {/* Forma + Racha */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Tooltip content="Últimas 5 partidas de este jugador en el torneo">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-mute cursor-default">Forma</span>
          </Tooltip>
          <Tooltip content="Resultados consecutivos del mismo signo">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-mute cursor-default">Racha</span>
          </Tooltip>
        </div>
      </div>

      {/* Body */}
      {standings.length === 0 && !loading ? (
        <LeaderboardEmpty tournamentId={tournamentId} isOrganizer={isOrganizer} />
      ) : loading && standings.length === 0 ? (
        <LeaderboardSkeleton />
      ) : displayed.length === 0 ? (
        <div className="py-10 text-center text-text-mute text-sm">No se encontraron jugadores.</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            {displayed.map((row) => {
              const isViewer = viewerId !== null && row.user_id === viewerId;
              const isFlashing = flashIds.has(row.user_id);
              const displayName = row.display_name || row.username;

              return (
                <div
                  key={row.user_id}
                  onClick={() => router.push(`/profile/${row.username}`)}
                  className={[
                    "group flex items-center gap-2 px-4 py-3 cursor-pointer border-t border-border/40 first:border-t-0",
                    "hover:bg-surface-2/50 transition-all duration-150",
                    isViewer
                      ? "border-l-[3px] border-l-primary bg-surface-2/30"
                      : "border-l-[3px] border-l-transparent",
                    isFlashing ? "bg-primary/5" : "",
                  ].filter(Boolean).join(" ")}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/profile/${row.username}`)}
                  aria-label={`Ver perfil de ${displayName}`}
                >
                  {/* Rank badge */}
                  <div className="w-7 shrink-0 flex items-center justify-center">
                    <RankBadge rank={row.rank} />
                  </div>

                  {/* Avatar con anillo dorado para #1 */}
                  <div className="w-7 shrink-0 relative">
                    <span className={`inline-block rounded-full ${goldRingClass(row.rank)}`}>
                      <Avatar
                        player={{ username: row.username, display_name: row.display_name, avatar_url: row.avatar_url }}
                        size={28}
                      />
                    </span>
                  </div>

                  {/* Nombre + Global rating + movimiento */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate text-text group-hover:text-primary transition-colors duration-150">
                        {highlightName(displayName)}
                      </span>
                      <MovementIndicator currentRank={row.rank} prevRank={row.prev_rank} />
                      {isViewer && (
                        <Tooltip content="Esa eres tú" className="hidden md:inline-flex">
                          <span className="text-[10px] text-primary font-semibold">(tú)</span>
                        </Tooltip>
                      )}
                      {/* Stats en mobile (comprimidos) */}
                      <span className="flex sm:hidden items-center gap-1.5 ml-auto shrink-0">
                        <span className="text-xs text-primary font-semibold">{row.wins}V</span>
                        <span className="text-xs text-text-mute">{row.losses}D</span>
                        <StreakChip streak={row.streak} />
                      </span>
                    </div>
                    <div className="text-text-mute text-[11px] mt-0.5">
                      Global ·{" "}
                      {row.is_rated && row.global_display != null
                        ? Number(row.global_display).toFixed(1)
                        : "—"}
                    </div>
                  </div>

                  {/* Stats desktop */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0 font-mono text-sm tabular-nums">
                    <span className="w-8 text-right text-primary font-semibold">{row.wins}</span>
                    <span className="w-8 text-right text-text-mute">{row.losses}</span>
                    <span className="w-10 text-right font-bold text-text">{row.win_pct.toFixed(0)}%</span>
                    <span className="w-12 text-right text-text">
                      {Number(row.effectiveness_coefficient ?? 0).toFixed(2)}
                    </span>
                    <span className="w-10 text-right text-text">{row.pf}</span>
                    <span className="w-10 text-right text-text-mute">{row.pc}</span>
                    <span className={`w-10 text-right font-semibold ${row.plus_minus > 0 ? "text-primary" : row.plus_minus < 0 ? "text-danger" : "text-text-mute"}`}>
                      {row.plus_minus > 0 ? "+" : ""}{row.plus_minus}
                    </span>
                  </div>

                  {/* Forma + Racha — solo md+ */}
                  <div className="hidden md:flex items-center gap-3 shrink-0">
                    <FormDots last5={row.last5} />
                    <StreakChip streak={row.streak} />
                  </div>

                  {/* Chevron sutil en hover desktop */}
                  <span className="hidden group-hover:inline-flex sm:w-4 items-center justify-center text-text-mute text-xs shrink-0" aria-hidden="true">
                    ›
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Utilidad: tiempo relativo simple ───────────────────────────────────────

function getRelativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5)  return "unos segundos";
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}
