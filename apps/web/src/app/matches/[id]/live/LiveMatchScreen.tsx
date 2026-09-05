"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MatchTimer } from "@/components/match/MatchTimer";
import Image from "next/image";
import { MODALIDADES, SETS, type CountRule, type ModalityCode, type SetCode, type FormatCode } from "@domirank/shared/matches";
import { matchLabel } from "@/lib/match-label";
import { addRound, undoLastRound, cancelLiveMatch, finalizeMatch } from "@/lib/live-match";
import { validateMatchClosure } from "@domirank/shared/matches";
import { useMatchTimer } from "@/hooks/useMatchTimer";
import { analytics } from "@/lib/analytics";
import { ContinuousLeagueFinishedState } from "@/components/continuous-league/ContinuousLeagueFinishedState";
import { HandRow, type HandRowData } from "@/components/match/HandRow";
import { ScoreKeeperTransfer } from "@/components/match/ScoreKeeperTransfer";
import { EditHandModal } from "@/components/match/EditHandModal";
import { useToast } from "@/components/Toast";

type PublicUser = { id: string; username: string; display_name: string | null; avatar_url: string | null; country: string | null };
type AttributionProfile = { username: string; display_name: string | null; avatar_url: string | null };
type Round = HandRowData & {
  /** Legacy alias kept for compute below; mirrors `recorded_at`. */
  created_at: string;
};

export function LiveMatchScreen({
  matchId, modality, countRule, setSize, format, targetPoints, capicuaBonus,
  startedAt, teamA, teamB, rounds,
  timeLimitMinutes, timerStartedAt,
  isSpectator = false,
  tournamentId = null,
  tournamentName = null,
  isContinuousLeague = false,
  matchStatus = "in_progress",
  isCreator = false,
  currentScoreKeeperId,
  currentUserId,
}: {
  matchId: string;
  modality: ModalityCode;
  countRule: CountRule | null;
  setSize: SetCode;
  format: FormatCode;
  targetPoints: number;
  capicuaBonus: number;
  startedAt: string;
  teamA: PublicUser[];
  teamB: PublicUser[];
  rounds: Round[];
  /** time_limit_minutes de la partida. null si no tiene límite de tiempo. */
  timeLimitMinutes: number | null;
  /** timer_started_at de la partida. null si el cronómetro aún no arrancó. */
  timerStartedAt: string | null;
  /** Si true: usuario es espectador — UI read-only, sin numpad ni botones de scoring. */
  isSpectator?: boolean;
  /** ID del torneo al que pertenece esta partida (null si no es de torneo). */
  tournamentId?: string | null;
  /** Nombre del torneo para mostrar en el breadcrumb. */
  tournamentName?: string | null;
  /** Si true: comportamiento polla — Tranque visible, "Abandonar" en lugar de
   *  "Cancelar", cancel/finalize redirigen a /tournaments/[id], saltea
   *  attestation (server-side detect). */
  isContinuousLeague?: boolean;
  /** Status del match. Cuando es 'confirmed' (polla finalizada) renderizamos
   *  el trophy state inline en lugar del round panel. */
  matchStatus?: "in_progress" | "confirmed" | "pending_attestation";
  /** True si el current user creó esta partida (puede Editar/Eliminar). */
  isCreator?: boolean;
  /** ID del score-keeper actual (matches.scorekeeper_id). C5. */
  currentScoreKeeperId?: string | null;
  /** ID del viewer actual. C5. */
  currentUserId?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [activeTeam, setActiveTeam] = useState<1 | 2>(() => {
    if (rounds.length === 0) return 1;
    const last = rounds[rounds.length - 1];
    return last.team === 2 ? 2 : 1;
  });
  const [input, setInput] = useState(0);

  // Sprint 3: persistir input y activeTeam en localStorage por matchId. Si el
  // token expira o el usuario hace F5 a mitad de escribir una mano, al volver
  // a esta pantalla restauramos el buffer. Se limpia al finalizar/cancelar.
  const draftKey = `match-draft:${matchId}`;
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { input?: number; activeTeam?: 1 | 2 };
      if (parsed && typeof parsed.input === "number" && parsed.input > 0) {
        setInput(parsed.input);
      }
      if (parsed && (parsed.activeTeam === 1 || parsed.activeTeam === 2)) {
        setActiveTeam(parsed.activeTeam);
      }
    } catch {
      /* ignore corrupt draft */
    }
    // Solo al montar por matchId. No re-corre en cada cambio de state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (input === 0) {
        // Solo persistimos el team activo si hay algo escrito, para no
        // pisar la herencia natural del último round al re-montar.
        window.localStorage.removeItem(draftKey);
      } else {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ input, activeTeam }),
        );
      }
    } catch {
      /* localStorage disabled / quota exceeded — silent */
    }
  }, [draftKey, input, activeTeam]);

  function clearDraft() {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(draftKey); } catch {}
  }
  const [err, setErr] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editingHandId, setEditingHandId] = useState<number | null>(null);

  // Cronómetro reactivo (solo activo si la partida tiene límite de tiempo)
  const timer = useMatchTimer(timerStartedAt, timeLimitMinutes);

  const mod = MODALIDADES[modality] ?? MODALIDADES.custom;
  const label = matchLabel({ count_rule: countRule, modality, target_points: targetPoints });
  const scoreA = rounds.filter((r) => r.team === 1).reduce((s, r) => s + r.points, 0);
  const scoreB = rounds.filter((r) => r.team === 2).reduce((s, r) => s + r.points, 0);
  const validation = validateMatchClosure(scoreA, scoreB, targetPoints, timer.isExpired);
  const nameOf = (arr: PublicUser[]) => arr.map((p) => (p.display_name || p.username).split(" ")[0]).join(" & ");
  const nameA = nameOf(teamA);
  const nameB = nameOf(teamB);
  // finishable cuando hay ganador definitivo (por meta o por tiempo con diferencia)
  const isFinishable =
    validation.status === 'finishable' ||
    (validation.status === 'time_expired_finishable' && validation.winnerTeam !== null);
  const winnerName = isFinishable && (validation.status === 'finishable' || validation.status === 'time_expired_finishable')
    ? (validation.winnerTeam === 1 ? nameA : nameB)
    : null;
  const pctA = Math.min(100, (scoreA / targetPoints) * 100);
  const pctB = Math.min(100, (scoreB / targetPoints) * 100);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setErr(null);
    setPending(true);
    try {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Error");
      else {
        if (onOk) onOk();
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  function doAdd() {
    if (input <= 0) return;
    const scoredTeam = activeTeam;
    const points = input;
    run(
      () => addRound({ match_id: matchId, team: scoredTeam, points, kind: "points" }),
      () => {
        setInput(0);
        setErr(null);
        toast.success(`+${points} · ${scoredTeam === 1 ? nameA : nameB}`);
      },
    );
  }
  function doCapicua() {
    const scoredTeam = activeTeam;
    run(
      () => addRound({ match_id: matchId, team: scoredTeam, points: capicuaBonus, kind: "capicua" }),
      () => {
        setInput(0);
        setErr(null);
        toast.success(`¡Capicúa! +${capicuaBonus} · ${scoredTeam === 1 ? nameA : nameB}`);
      },
    );
  }
  function doTranque() {
    // Tranque: marca la mano (kind='tranque') sin sumar puntos al score.
    // Útil para registrar que hubo tranque en el historial.
    const scoredTeam = activeTeam;
    run(
      () => addRound({ match_id: matchId, team: scoredTeam, points: 0, kind: "tranque" }),
      () => {
        setInput(0);
        setErr(null);
        toast.info(`Tranque · ${scoredTeam === 1 ? nameA : nameB}`);
      },
    );
  }
  function doUndo() {
    run(
      () => undoLastRound(matchId),
      () => {
        setErr(null);
        toast.info("Última mano deshecha");
      },
    );
  }
  async function doCancel() {
    if (rounds.length > 0) {
      setConfirmCancel(true);
      return;
    }
    await cancelImmediate();
  }
  async function cancelImmediate() {
    setConfirmCancel(false);
    setPending(true);
    try {
      clearDraft();
      // En polla redirige al home de la polla, en quick match al dashboard.
      const redirectTo = isContinuousLeague && tournamentId ? `/tournaments/${tournamentId}` : "/dashboard";
      await cancelLiveMatch(matchId, redirectTo);
    } finally {
      setPending(false);
    }
  }
  async function doFinalize() {
    setErr(null);
    setPending(true);
    try {
      const r = await finalizeMatch(matchId);
      if (r.ok) {
        clearDraft();
        const winnerTeam =
          (validation.status === "finishable" || validation.status === "time_expired_finishable") &&
          validation.winnerTeam != null
            ? validation.winnerTeam === 1 ? nameA : nameB
            : "unknown";
        analytics.track("match_finalized", { match_id: matchId, winner_team: winnerTeam });
        if (r.groupAttributions && r.groupAttributions.length > 0) {
          const names = r.groupAttributions.join(" · ");
          toast.success(
            r.groupAttributions.length === 1
              ? `Cuenta para el grupo ${names}`
              : `Cuenta para los grupos ${names}`,
          );
        }
        // En polla: refresh para que el page re-renderice con status='confirmed'
        // y aparezca el inline trophy state. En quick match: redirect a detalle.
        if (isContinuousLeague && tournamentId) {
          router.refresh();
        } else {
          router.push(`/matches/${matchId}`);
        }
      } else {
        setErr(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  const start = new Date(startedAt);
  const todayLabel = `Hoy · ${start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="max-w-xl mx-auto">
      {/* Breadcrumb de torneo — Feature 3 */}
      {tournamentId && tournamentName && (
        <div className="sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{ background: "rgba(var(--primary-rgb, 59 130 246)/.08)", borderColor: "rgba(var(--primary-rgb, 59 130 246)/.25)" }}>
          {/* Trophy icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-primary">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          </svg>
          <span className="flex-1 truncate text-text-dim">
            Partida en <span className="font-medium text-text">{tournamentName}</span>
          </span>
          <Link
            href={`/tournaments/${tournamentId}`}
            className="shrink-0 text-primary hover:underline font-medium"
          >
            ← Volver al torneo
          </Link>
        </div>
      )}

      {/* Banner espectador — Feature 1 + Spec C9 */}
      {isSpectator && (
        <div className="mb-3 rounded-lg border border-border bg-surface-2 px-4 py-3 flex items-center justify-center gap-2 text-sm text-text-mute">
          <span aria-hidden="true">👁</span>
          <span>
            <strong className="text-text">Mirando como espectador.</strong> Sin permiso para registrar ni editar manos.
          </span>
        </div>
      )}

      {/* Header — flecha atrás = up-nav (torneo o dashboard). NO cancela la
          partida; el active-match chip queda para retomar. Cancelar vive en
          "Abandonar partida" al pie. */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => {
            const backPath = tournamentId ? `/tournaments/${tournamentId}` : "/dashboard";
            if (!isSpectator) {
              toast.info("Partida pausada — retomala desde el chip flotante cuando quieras.");
            }
            router.push(backPath);
          }}
          className="grid place-items-center w-10 h-10 rounded-md bg-surface border border-border hover:bg-surface-2"
          aria-label="Volver"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold leading-tight">Partida</h1>
          <div className="text-text-mute text-xs flex items-center gap-1.5" title={label.blurb}>
            <Image src={label.icon} alt="" width={16} height={16} aria-hidden="true" className="inline-block" />
            <span>{label.chip} · {SETS[setSize].label} · capicúa +{capicuaBonus}</span>
          </div>
        </div>
      </div>

      {/* Cronómetro — solo visible si la partida tiene límite de tiempo */}
      <MatchTimer
        startedAt={timerStartedAt}
        timeLimitMinutes={timeLimitMinutes}
      />

      {/* Team tiles */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <TeamTile
          color="A" name={nameA} score={scoreA} pct={pctA}
          active={activeTeam === 1} onClick={() => !isFinishable && validation.status !== 'tied_at_goal' && setActiveTeam(1)}
          players={teamA}
        />
        <TeamTile
          color="B" name={nameB} score={scoreB} pct={pctB}
          active={activeTeam === 2} onClick={() => !isFinishable && validation.status !== 'tied_at_goal' && setActiveTeam(2)}
          players={teamB}
        />
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 mb-4">
        <div>
          <div className="text-text-mute text-xs uppercase tracking-wider">Meta</div>
          <div className="font-bold mt-0.5">{targetPoints} puntos</div>
        </div>
        <div className="text-right">
          <div className="text-text-mute text-xs uppercase tracking-wider">
            {matchStatus === "confirmed" ? "Finalizada" : isFinishable ? "Listo" : "En curso"}
          </div>
          <div className="font-bold mt-0.5">{todayLabel}</div>
        </div>
      </div>

      {err && !isSpectator && <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-danger text-sm mb-3">{err}</div>}

      {/* === Inline trophy state para pollas finalizadas === */}
      {isContinuousLeague && matchStatus === "confirmed" && tournamentId && (
        <ContinuousLeagueFinishedState
          matchId={matchId}
          tournamentId={tournamentId}
          winnerName={scoreA > scoreB ? nameA : nameB}
          scoreA={scoreA}
          scoreB={scoreB}
          isCreator={isCreator}
        />
      )}

      {/* === Resto del flow: solo cuando NO es polla finalizada === */}
      {!(isContinuousLeague && matchStatus === "confirmed") && !isSpectator && (isFinishable ? (
        <div className="space-y-3">
          <div className="p-4 bg-primary/10 border border-primary/30 rounded-md text-primary text-center font-medium">
            {validation.status === 'time_expired_finishable'
              ? `Tiempo agotado — ${winnerName} gana por puntaje`
              : `${winnerName} llegó a la meta`}
          </div>
          <button className="btn-primary w-full" disabled={pending} onClick={doFinalize}>
            Finalizar
          </button>
          <button className="btn-ghost w-full" disabled={pending} onClick={doUndo}>
            Deshacer última mano
          </button>
        </div>
      ) : validation.status === 'time_expired_finishable' && validation.winnerTeam === null ? (
        <div className="space-y-3">
          <div className="p-4 rounded-md text-center font-medium bg-warning/10 border border-warning/30 text-warning">
            Tiempo agotado y empate — jueguen una mano adicional para desempatar
          </div>
          <button className="btn-ghost w-full" disabled={pending} onClick={doUndo}>
            Deshacer última mano
          </button>
        </div>
      ) : validation.status === 'tied_at_goal' ? (
        <div className="space-y-3">
          <div className="p-4 bg-danger/10 border border-danger/30 rounded-md text-danger text-center font-medium">
            Empate — jueguen una mano adicional para desempatar
          </div>
          <button className="btn-ghost w-full" disabled={pending} onClick={doUndo}>
            Deshacer última mano
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">Registrar puntos</h2>
            <span className="text-text-mute text-sm">¿Quién suma?</span>
          </div>
          <div className="flex bg-surface-2 border border-border rounded-md p-1 gap-1 mb-3">
            <button type="button" onClick={() => setActiveTeam(1)} className={`flex-1 py-2 rounded text-sm font-medium ${activeTeam === 1 ? "bg-teamA/20 text-teamA ring-1 ring-teamA/50 ring-inset" : "text-text-dim"}`}>{nameA}</button>
            <button type="button" onClick={() => setActiveTeam(2)} className={`flex-1 py-2 rounded text-sm font-medium ${activeTeam === 2 ? "bg-teamB/20 text-teamB ring-1 ring-teamB/50 ring-inset" : "text-text-dim"}`}>{nameB}</button>
          </div>
          <div className={`h-14 bg-surface-2 border border-border-strong rounded-lg flex items-center justify-end px-4 mb-3 font-mono text-2xl font-semibold ${input === 0 ? "text-text-mute font-normal text-base" : ""}`}>
            {input === 0 ? "Ingresa los puntos" : input}
          </div>
          <Numpad
            disabled={pending}
            onDigit={(d) => setInput((cur) => Math.min(999, cur * 10 + d))}
            onClear={() => setInput(0)}
            onBackspace={() => setInput((cur) => Math.floor(cur / 10))}
          />
          <div className="flex gap-2 mt-3">
            <button type="button" className="btn-ghost flex-1" disabled={pending || rounds.length === 0} onClick={doUndo}>
              Deshacer
            </button>
            <button
              type="button"
              className="flex-1 py-2 rounded-md font-medium border bg-warning/10 border-warning/30 text-warning"
              disabled={pending}
              onClick={doCapicua}
            >
              ¡Capicúa! +{capicuaBonus}
            </button>
            <button type="button" className="btn-primary flex-1" disabled={pending || input <= 0} onClick={doAdd}>
              Sumar
            </button>
          </div>
          {/* Tranque: sólo en modo polla. Registra la mano sin sumar puntos. */}
          {isContinuousLeague && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded-md font-medium border border-border text-text-mute hover:bg-surface-2 transition text-sm"
                disabled={pending}
                onClick={doTranque}
                title="Registra la mano como tranque (sin sumar puntos)"
              >
                ⏹ Tranque
              </button>
              <button
                type="button"
                className="flex-1 py-2 rounded-md font-medium border border-danger/30 text-danger hover:bg-danger/10 transition text-sm"
                disabled={pending}
                onClick={doCancel}
              >
                Abandonar partida
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Score-keeper transfer — solo visible si el viewer es el current keeper
          y la partida está in_progress. */}
      {!isSpectator
        && matchStatus === "in_progress"
        && currentUserId
        && currentScoreKeeperId === currentUserId
        && (teamA.length + teamB.length) > 1 && (
        <ScoreKeeperTransfer
          matchId={matchId}
          currentKeeperId={currentScoreKeeperId}
          candidates={[...teamA, ...teamB].map((p) => ({
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
          }))}
        />
      )}

      {/* Rounds list */}
      <div className="mt-5 card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold">Manos jugadas ({rounds.length})</div>
        {rounds.length === 0 ? (
          <div className="px-4 py-6 text-center text-text-mute text-sm">Aún no hay manos registradas.</div>
        ) : (
          rounds.slice().reverse().map((r) => (
            <HandRow
              key={r.id}
              hand={r}
              nameA={nameA}
              nameB={nameB}
              canEdit={!isSpectator}
              onEdit={(id) => setEditingHandId(id)}
            />
          ))
        )}
      </div>

      <EditHandModal
        open={editingHandId !== null}
        hand={editingHandId === null ? null : (() => {
          const r = rounds.find((x) => x.id === editingHandId);
          if (!r) return null;
          return {
            id: r.id, round_number: r.round_number, team: r.team,
            points: r.points, kind: r.kind as "points" | "capicua" | "tranque",
          };
        })()}
        matchId={matchId}
        nameA={nameA}
        nameB={nameB}
        onClose={() => setEditingHandId(null)}
      />

      <ConfirmDialog
        open={confirmCancel}
        title="¿Cancelar la partida?"
        description={`${rounds.length === 0
          ? "Esta partida no tiene manos registradas todavía. Cancelar es seguro."
          : `Esta partida tiene ${rounds.length} mano${rounds.length === 1 ? "" : "s"} registradas. Si la cancelás, NO afecta el rating de nadie. Tenés 5 minutos para revertir antes de que quede definitiva.`}`}
        confirmLabel="Sí, cancelar"
        cancelLabel="Seguir jugando"
        destructive
        pending={pending}
        onConfirm={cancelImmediate}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}

function TeamTile({
  color, name, score, pct, active, onClick, players,
}: {
  color: "A" | "B";
  name: string;
  score: number;
  pct: number;
  active: boolean;
  onClick: () => void;
  players: PublicUser[];
}) {
  const isA = color === "A";
  const teamVar = isA ? "var(--color-team-a)" : "var(--color-team-b)";
  const baseBg = `rgb(${teamVar} / 0.10)`;
  const borderCol = active ? `rgb(${teamVar} / 0.7)` : `rgb(${teamVar} / 0.25)`;
  const ring = active ? `0 0 0 3px rgb(${teamVar} / 0.15)` : "none";
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative overflow-hidden rounded-xl p-4 text-left transition-transform hover:-translate-y-0.5"
      style={{ background: `linear-gradient(180deg, ${baseBg}, transparent 80%)`, border: `1px solid ${borderCol}`, boxShadow: ring }}
    >
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase mb-2 ${isA ? "bg-teamA/15 text-teamA" : "bg-teamB/15 text-teamB"}`}
      >
        {players.length === 1 ? `Jugador ${color}` : `Pareja ${color}`}
      </span>
      <div className="font-semibold text-base leading-tight truncate">{name || "—"}</div>
      <div className="text-4xl font-extrabold mt-2 font-mono">{score}</div>
      <div className="absolute left-4 right-4 bottom-2 h-1 bg-surface-3 rounded">
        <span
          className={`block h-full rounded transition-all ${isA ? "bg-teamA" : "bg-teamB"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}

function Numpad({
  disabled, onDigit, onClear, onBackspace,
}: {
  disabled: boolean;
  onDigit: (d: number) => void;
  onClear: () => void;
  onBackspace: () => void;
}) {
  const Key = ({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`py-4 rounded-lg border text-xl font-semibold transition-transform active:scale-95 ${danger ? "text-danger" : ""}`}
      style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
    >
      {children}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-2">
      {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((d) => (
        <Key key={d} onClick={() => onDigit(d)}>{d}</Key>
      ))}
      <Key onClick={onClear} danger>C</Key>
      <Key onClick={() => onDigit(0)}>0</Key>
      <Key onClick={onBackspace}>⌫</Key>
    </div>
  );
}
