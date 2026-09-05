"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { createNewMatchInContinuousLeague } from "@/lib/continuous-league-actions";
import { useModalA11y } from "@/hooks/useModalA11y";

type Props = {
  tournamentId:   string;
  rosterUserIds:  string[];
  userNames:      Record<string, string>;
  currentUserId:  string;
  onClose:        () => void;
};

type Assignment = "A" | "B";

/** Shuffle Fisher-Yates. */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function randomAssign(selected: string[]): Record<string, Assignment> {
  const sh = shuffle(selected);
  return { [sh[0]]: "A", [sh[1]]: "A", [sh[2]]: "B", [sh[3]]: "B" };
}

export function NewMatchInContinuousLeagueModal({
  tournamentId, rosterUserIds, userNames, currentUserId, onClose,
}: Props) {
  const router = useRouter();
  const dialogRef = useModalA11y({ onClose });

  // Step 1: jugadores seleccionados (currentUser pre-marcado)
  const [selected, setSelected] = useState<string[]>([currentUserId]);

  // Step 2: modo + asignación de parejas
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [assign, setAssign] = useState<Record<string, Assignment>>({});

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamA = useMemo(() => selected.filter((uid) => assign[uid] === "A"), [selected, assign]);
  const teamB = useMemo(() => selected.filter((uid) => assign[uid] === "B"), [selected, assign]);
  const ready = teamA.length === 2 && teamB.length === 2;
  const step2Visible = selected.length === 4;

  function togglePlayer(uid: string) {
    setError(null);
    setSelected((cur) => {
      const idx = cur.indexOf(uid);
      if (idx >= 0) {
        // Deseleccionar — también limpiamos su assignment
        setAssign((a) => {
          const next = { ...a };
          delete next[uid];
          return next;
        });
        return cur.filter((_, i) => i !== idx);
      }
      if (cur.length >= 4) {
        setError("Máximo 4 jugadores.");
        return cur;
      }
      const next = [...cur, uid];
      // Si llegamos a 4 y aún no hay assignment, sortear automáticamente
      if (next.length === 4 && mode === "random") {
        setAssign(randomAssign(next));
      }
      return next;
    });
  }

  function switchMode(m: "random" | "manual") {
    setMode(m);
    if (m === "random" && selected.length === 4) {
      setAssign(randomAssign(selected));
    } else if (m === "manual") {
      setAssign({});
    }
  }

  function reroll() {
    if (selected.length !== 4) return;
    setAssign(randomAssign(selected));
  }

  function toggleAssign(uid: string, team: Assignment) {
    setAssign((cur) => {
      // Si ya está en ese team → quitar
      if (cur[uid] === team) {
        const next = { ...cur };
        delete next[uid];
        return next;
      }
      const next = { ...cur };
      // Auto-swap: si el equipo destino ya tiene 2, mover al primer ocupante al otro
      const teamMembers = selected.filter((x) => next[x] === team && x !== uid);
      if (teamMembers.length >= 2) {
        const otherTeam: Assignment = team === "A" ? "B" : "A";
        next[teamMembers[0]] = otherTeam;
      }
      next[uid] = team;
      return next;
    });
  }

  async function handleStart() {
    if (!ready) return;
    setPending(true);
    setError(null);
    const res = await createNewMatchInContinuousLeague({
      tournament_id: tournamentId,
      team_a:        teamA as [string, string],
      team_b:        teamB as [string, string],
    });
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    onClose();
    router.push(`/matches/${res.match_id}/live`);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-match-title"
        className="bg-bg w-full sm:max-w-md sm:rounded-2xl border-t sm:border border-border p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 animate-slide-up-fade max-h-[92svh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="new-match-title" className="text-lg font-semibold">Nueva partida</h2>

        {/* ===== STEP 1: SELECCIÓN ===== */}
        <Step1
          selected={selected}
          roster={rosterUserIds}
          userNames={userNames}
          onToggle={togglePlayer}
        />

        {/* ===== STEP 2: PAREJAS ===== */}
        {step2Visible && (
          <Step2
            selected={selected}
            assign={assign}
            mode={mode}
            userNames={userNames}
            onSwitchMode={switchMode}
            onReroll={reroll}
            onToggleAssign={toggleAssign}
          />
        )}

        {error && (
          <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 sticky bottom-0 bg-bg pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1" disabled={pending}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="btn-primary flex-1"
            disabled={!ready || pending}
          >
            {pending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin-fast" aria-hidden />
                Comenzando…
              </span>
            ) : "Comenzar →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// STEP 1 — Selección de 4 jugadores tappable
// ===========================================================================

function Step1({
  selected, roster, userNames, onToggle,
}: {
  selected:    string[];
  roster:      string[];
  userNames:   Record<string, string>;
  onToggle:    (uid: string) => void;
}) {
  return (
    <div>
      <div className="text-text-mute text-xs uppercase tracking-wide mb-2 font-semibold">
        Paso 1 · Selecciona 4 jugadores
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 min-h-[44px] mb-2 p-2 bg-bg-2 rounded-xl items-center">
        {selected.length === 0 ? (
          <span className="text-text-mute text-sm">Toca a 4 jugadores inscritos</span>
        ) : (
          selected.map((uid) => (
            <span key={uid} className="inline-flex items-center gap-1.5 bg-surface-2 rounded-full pl-1 pr-3 py-1 text-sm">
              <Avatar player={{ username: userNames[uid] ?? uid, display_name: null, avatar_url: null }} size={22} />
              <span className="truncate max-w-[100px]">{userNames[uid] ?? "?"}</span>
            </span>
          ))
        )}
        {selected.length > 0 && (
          <span className="ml-auto text-xs text-text-dim tabular-nums shrink-0">{selected.length}/4</span>
        )}
      </div>

      {/* Tappable list */}
      <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
        {roster.map((uid) => {
          const isSelected = selected.includes(uid);
          return (
            <button
              key={uid}
              type="button"
              onClick={() => onToggle(uid)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition min-h-[52px] ${
                isSelected
                  ? "bg-primary/10 border-primary"
                  : "bg-surface border-border hover:bg-surface-2"
              }`}
              aria-pressed={isSelected}
            >
              <Avatar player={{ username: userNames[uid] ?? uid, display_name: null, avatar_url: null }} size={36} />
              <span className="flex-1 text-left truncate font-medium">{userNames[uid] ?? "?"}</span>
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                isSelected ? "bg-primary border-primary" : "border-border-strong"
              }`} aria-hidden="true">
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a1020" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ===========================================================================
// STEP 2 — Armar parejas (modo random / manual)
// ===========================================================================

function Step2({
  selected, assign, mode, userNames, onSwitchMode, onReroll, onToggleAssign,
}: {
  selected:       string[];
  assign:         Record<string, Assignment>;
  mode:           "random" | "manual";
  userNames:      Record<string, string>;
  onSwitchMode:   (m: "random" | "manual") => void;
  onReroll:       () => void;
  onToggleAssign: (uid: string, team: Assignment) => void;
}) {
  const teamA = selected.filter((uid) => assign[uid] === "A");
  const teamB = selected.filter((uid) => assign[uid] === "B");

  return (
    <div>
      <div className="text-text-mute text-xs uppercase tracking-wide mb-2 font-semibold">
        Paso 2 · Armar parejas
      </div>

      {/* Mode segment */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-bg-2 rounded-xl mb-3">
        <button
          type="button"
          onClick={() => onSwitchMode("random")}
          className={`py-2.5 rounded-lg text-sm font-semibold transition ${
            mode === "random" ? "bg-surface text-text shadow-sm" : "text-text-mute"
          }`}
        >
          🔀 Aleatorio
        </button>
        <button
          type="button"
          onClick={() => onSwitchMode("manual")}
          className={`py-2.5 rounded-lg text-sm font-semibold transition ${
            mode === "manual" ? "bg-surface text-text shadow-sm" : "text-text-mute"
          }`}
        >
          ✋ Manual
        </button>
      </div>

      {/* Pair boxes */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <PairBox team="A" players={teamA} userNames={userNames} />
        <PairBox team="B" players={teamB} userNames={userNames} />
      </div>

      {mode === "random" && (
        <button
          type="button"
          onClick={onReroll}
          className="btn-ghost w-full text-sm"
        >
          🎲 Volver a sortear
        </button>
      )}

      {mode === "manual" && (
        <div className="space-y-1.5">
          {selected.map((uid) => (
            <div key={uid} className="flex items-center gap-3 p-2 rounded-xl bg-surface">
              <Avatar player={{ username: userNames[uid] ?? uid, display_name: null, avatar_url: null }} size={28} />
              <span className="flex-1 truncate text-sm font-medium">{userNames[uid] ?? "?"}</span>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleAssign(uid, "A")}
                  className={`w-10 h-10 rounded-lg font-bold text-sm transition ${
                    assign[uid] === "A"
                      ? "bg-teamA text-white"
                      : "bg-bg-2 text-text-mute border border-border"
                  }`}
                  aria-label={`Asignar ${userNames[uid] ?? "?"} a pareja A`}
                  aria-pressed={assign[uid] === "A"}
                >
                  A
                </button>
                <button
                  type="button"
                  onClick={() => onToggleAssign(uid, "B")}
                  className={`w-10 h-10 rounded-lg font-bold text-sm transition ${
                    assign[uid] === "B"
                      ? "bg-teamB text-white"
                      : "bg-bg-2 text-text-mute border border-border"
                  }`}
                  aria-label={`Asignar ${userNames[uid] ?? "?"} a pareja B`}
                  aria-pressed={assign[uid] === "B"}
                >
                  B
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PairBox({
  team, players, userNames,
}: {
  team:      "A" | "B";
  players:   string[];
  userNames: Record<string, string>;
}) {
  const isA = team === "A";
  return (
    <div
      className={`rounded-xl p-3 bg-surface border border-l-4 ${
        isA ? "border-l-teamA" : "border-l-teamB"
      } border-border min-h-[88px]`}
    >
      <div className={`text-xs font-bold uppercase tracking-wider mb-1.5 ${isA ? "text-teamA" : "text-teamB"}`}>
        Pareja {team}
      </div>
      {players.length === 0 ? (
        <div className="text-text-mute text-sm">—</div>
      ) : (
        <div className="space-y-0.5">
          {players.map((uid) => (
            <div key={uid} className="text-sm font-medium truncate">{userNames[uid] ?? "?"}</div>
          ))}
        </div>
      )}
      <div className="text-text-dim text-[10px] mt-1.5 tabular-nums">{players.length}/2</div>
    </div>
  );
}
