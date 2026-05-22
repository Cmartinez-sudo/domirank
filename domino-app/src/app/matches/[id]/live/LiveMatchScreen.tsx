"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MODALIDADES, SETS, type ModalityCode, type SetCode, type FormatCode } from "@/lib/modalidades";
import { addRound, undoLastRound, cancelLiveMatch, finalizeMatch } from "@/lib/live-match";
import { validateMatchClosure } from "@/lib/match-validation";

type PublicUser = { id: string; username: string; display_name: string | null; avatar_url: string | null; country: string | null };
type Round = { id: number; round_number: number; team: number; points: number; kind: string; created_at: string };

export function LiveMatchScreen({
  matchId, modality, setSize, format, targetPoints, capicuaBonus,
  startedAt, teamA, teamB, rounds,
}: {
  matchId: string;
  modality: ModalityCode;
  setSize: SetCode;
  format: FormatCode;
  targetPoints: number;
  capicuaBonus: number;
  startedAt: string;
  teamA: PublicUser[];
  teamB: PublicUser[];
  rounds: Round[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [activeTeam, setActiveTeam] = useState<1 | 2>(1);
  const [input, setInput] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const mod = MODALIDADES[modality] ?? MODALIDADES.custom;
  const scoreA = rounds.filter((r) => r.team === 1).reduce((s, r) => s + r.points, 0);
  const scoreB = rounds.filter((r) => r.team === 2).reduce((s, r) => s + r.points, 0);
  const validation = validateMatchClosure(scoreA, scoreB, targetPoints);
  const nameOf = (arr: PublicUser[]) => arr.map((p) => (p.display_name || p.username).split(" ")[0]).join(" & ");
  const nameA = nameOf(teamA);
  const nameB = nameOf(teamB);
  const winnerName = validation.status === 'finishable'
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
    run(
      () => addRound({ match_id: matchId, team: activeTeam, points: input, kind: "points" }),
      () => { setInput(0); setErr(null); },
    );
  }
  function doCapicua() {
    run(
      () => addRound({ match_id: matchId, team: activeTeam, points: capicuaBonus, kind: "capicua" }),
      () => { setInput(0); setErr(null); },
    );
  }
  function doUndo() {
    run(() => undoLastRound(matchId), () => setErr(null));
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
    try { await cancelLiveMatch(matchId); } finally { setPending(false); }
  }
  async function doFinalize() {
    setErr(null);
    setPending(true);
    try {
      const r = await finalizeMatch(matchId);
      if (r.ok) router.push(`/matches/${matchId}`);
      else setErr(r.error);
    } finally {
      setPending(false);
    }
  }

  const start = new Date(startedAt);
  const todayLabel = `Hoy · ${start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={doCancel} disabled={pending} className="grid place-items-center w-10 h-10 rounded-md bg-surface border border-border hover:bg-surface-2" aria-label="Cancelar partida">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold leading-tight">Partida</h1>
          <div className="text-text-mute text-xs">
            {mod.flag} {mod.name} · {SETS[setSize].label} · capicúa +{capicuaBonus}
          </div>
        </div>
      </div>

      {/* Team tiles */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <TeamTile
          color="A" name={nameA} score={scoreA} pct={pctA}
          active={activeTeam === 1} onClick={() => validation.status === 'in_progress' && setActiveTeam(1)}
          players={teamA}
        />
        <TeamTile
          color="B" name={nameB} score={scoreB} pct={pctB}
          active={activeTeam === 2} onClick={() => validation.status === 'in_progress' && setActiveTeam(2)}
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
            {validation.status === 'finishable' ? "Listo" : "En curso"}
          </div>
          <div className="font-bold mt-0.5">{todayLabel}</div>
        </div>
      </div>

      {err && <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-danger text-sm mb-3">{err}</div>}

      {validation.status === 'finishable' ? (
        <div className="space-y-3">
          <div className="p-4 bg-primary/10 border border-primary/30 rounded-md text-primary text-center font-medium">
            {winnerName} llegó a la meta
          </div>
          <button className="btn-primary w-full" disabled={pending} onClick={doFinalize}>
            Finalizar y actualizar rating
          </button>
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
            <button type="button" onClick={() => setActiveTeam(1)} className={`flex-1 py-2 rounded text-sm font-medium ${activeTeam === 1 ? "bg-teamA/20 text-teamA" : "text-text-dim"}`} style={activeTeam === 1 ? { boxShadow: "inset 0 0 0 1px rgba(59,130,246,.5)" } : {}}>{nameA}</button>
            <button type="button" onClick={() => setActiveTeam(2)} className={`flex-1 py-2 rounded text-sm font-medium ${activeTeam === 2 ? "bg-teamB/20 text-teamB" : "text-text-dim"}`} style={activeTeam === 2 ? { boxShadow: "inset 0 0 0 1px rgba(239,68,68,.5)" } : {}}>{nameB}</button>
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
              className="flex-1 py-2 rounded-md font-medium border"
              style={{ background: "rgba(245,158,11,.12)", borderColor: "rgba(245,158,11,.3)", color: "#f59e0b" }}
              disabled={pending}
              onClick={doCapicua}
            >
              ¡Capicúa! +{capicuaBonus}
            </button>
            <button type="button" className="btn-primary flex-1" disabled={pending || input <= 0} onClick={doAdd}>
              Sumar
            </button>
          </div>
        </div>
      )}

      {/* Rounds list */}
      <div className="mt-5 card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold">Manos jugadas ({rounds.length})</div>
        {rounds.length === 0 ? (
          <div className="px-4 py-6 text-center text-text-mute text-sm">Aún no hay manos registradas.</div>
        ) : (
          rounds.slice().reverse().map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 text-sm first:border-t-0">
              <span className="text-text-mute font-mono">#{r.round_number}</span>
              <span className={r.team === 1 ? "text-teamA font-medium" : "text-teamB font-medium"}>
                {r.team === 1 ? nameA : nameB}
              </span>
              <span className="font-mono font-semibold">
                +{r.points}
                {r.kind === "capicua" && <span className="text-warning ml-1 text-xs">capicúa</span>}
              </span>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        title="¿Cancelar la partida?"
        description={`Vas a perder ${rounds.length} mano${rounds.length === 1 ? "" : "s"} registradas. Esta acción no se puede deshacer.`}
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
  const baseBg = isA ? "rgba(59,130,246,.10)" : "rgba(239,68,68,.10)";
  const borderCol = active ? (isA ? "rgba(59,130,246,.7)" : "rgba(239,68,68,.7)") : (isA ? "rgba(59,130,246,.25)" : "rgba(239,68,68,.25)");
  const ring = active ? (isA ? "0 0 0 3px rgba(59,130,246,.15)" : "0 0 0 3px rgba(239,68,68,.15)") : "none";
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative overflow-hidden rounded-xl p-4 text-left transition-transform hover:-translate-y-0.5"
      style={{ background: `linear-gradient(180deg, ${baseBg}, transparent 80%)`, border: `1px solid ${borderCol}`, boxShadow: ring }}
    >
      <span
        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase mb-2"
        style={{ background: isA ? "rgba(59,130,246,.15)" : "rgba(239,68,68,.15)", color: isA ? "#3b82f6" : "#ef4444" }}
      >
        {players.length === 1 ? `Jugador ${color}` : `Pareja ${color}`}
      </span>
      <div className="font-semibold text-base leading-tight truncate">{name || "—"}</div>
      <div className="text-4xl font-extrabold mt-2 font-mono">{score}</div>
      <div className="absolute left-4 right-4 bottom-2 h-1 bg-white/5 rounded">
        <span
          className="block h-full rounded transition-all"
          style={{ width: `${pct}%`, background: isA ? "#3b82f6" : "#ef4444" }}
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
