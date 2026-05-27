"use client";

/**
 * Wizard de nueva partida — 2 pasos:
 *   Step 1 (MODALITY): selección de modalidad + parámetros + checkbox "No volver a preguntar"
 *   Step 2 (PLAYERS):  armado de equipos + badge "Modalidad: X · Cambiar" si se saltó el step 1
 *
 * Skip flow (US-05):
 *   Si preferences.skip_modality_prompt === true && preferences.default_match_modality !== null
 *   → montar directamente en step PLAYERS con la modalidad por defecto.
 *   El badge "Cambiar" permite override puntual (solo state local, no toca DB).
 */

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import { RatingBadge } from "@/components/RatingBadge";
import {
  MODALIDADES,
  type ModalityCode,
  type SetCode,
  type FormatCode,
} from "@/lib/modalidades";
import { startLiveMatch } from "@/lib/live-match";
import { linkMatchToPairing } from "@/lib/tournament-pairing-link";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import type { UserPreferences } from "@/types/user-preferences";
import { analytics } from "@/lib/analytics";

type Player = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  global_display?: number | null;
  total_games?: number | null;
};

type Step = "modality" | "players";

export function NewMatchForm({
  currentUser,
  defaultModality,
  initialPreferences,
}: {
  currentUser: Player;
  defaultModality: ModalityCode;
  initialPreferences?: UserPreferences | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetTournamentId = searchParams.get("tournament");
  const presetPairingId = searchParams.get("pairing");

  const { preferences, update } = useUserPreferences(initialPreferences);

  // Determinar si debemos saltar el step de modalidad
  const shouldSkipModality =
    (preferences?.skip_modality_prompt === true &&
      preferences?.default_match_modality != null) ||
    (initialPreferences?.skip_modality_prompt === true &&
      initialPreferences?.default_match_modality != null);

  // Edge case: inconsistent state (skip=true pero default_modality=null)
  const hasInconsistentPreferences =
    (preferences?.skip_modality_prompt === true &&
      preferences?.default_match_modality == null) ||
    (initialPreferences?.skip_modality_prompt === true &&
      initialPreferences?.default_match_modality == null);

  if (hasInconsistentPreferences) {
    console.warn(
      "[NewMatchForm] Estado inconsistente: skip_modality_prompt=true pero default_match_modality=null. Flow normal.",
      // TODO: Sentry.captureMessage('modality_skip_inconsistent_state', { level: 'warning' })
    );
  }

  const effectiveDefaultModality =
    (preferences?.default_match_modality ??
      initialPreferences?.default_match_modality ??
      defaultModality) as ModalityCode;

  const [step, setStep] = useState<Step>(
    shouldSkipModality ? "players" : "modality",
  );
  // Indica si este render llegó a players via skip (para mostrar badge)
  const [arrivedViaSkip, setArrivedViaSkip] = useState(shouldSkipModality);

  // Checkbox "No volver a preguntar esta modalidad"
  const [skipNextTime, setSkipNextTime] = useState(false);

  // Modalidad + parámetros
  const [modality, setModality] = useState<ModalityCode>(effectiveDefaultModality);
  const m = MODALIDADES[modality];
  const isCustom = modality === "custom";

  const [format, setFormat] = useState<FormatCode>(m.format);
  const [setSize, setSetSize] = useState<SetCode>(m.set);
  const [target, setTarget] = useState<number>(m.target);
  const [capicua, setCapicua] = useState<number>(m.capicua);

  // Equipos
  const [teamA, setTeamA] = useState<Player[]>([currentUser]);
  const [teamB, setTeamB] = useState<Player[]>([]);

  const teamSize = format === "singles" ? 1 : 2;

  // Toggle "amistosa" — la partida no afecta el Elo global
  const [friendly, setFriendly] = useState(false);

  // Submit
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // US-09: track modality_step_skipped only on first mount when arrived via skip
  useEffect(() => {
    if (arrivedViaSkip) {
      analytics.track("modality_step_skipped", { modality });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyModality(code: ModalityCode) {
    setModality(code);
    if (code !== "custom") {
      const x = MODALIDADES[code];
      setFormat(x.format);
      setSetSize(x.set);
      setTarget(x.target);
      setCapicua(x.capicua);
      const sz = x.format === "singles" ? 1 : 2;
      setTeamA((cur) => cur.slice(0, sz));
      setTeamB((cur) => cur.slice(0, sz));
    }
  }

  function applyFormat(f: FormatCode) {
    setFormat(f);
    const sz = f === "singles" ? 1 : 2;
    setTeamA((cur) => cur.slice(0, sz));
    setTeamB((cur) => cur.slice(0, sz));
  }

  async function handleModalityContinue() {
    if (skipNextTime) {
      try {
        await update({
          default_match_modality: modality as Exclude<ModalityCode, "custom">,
          skip_modality_prompt: true,
        });
        analytics.track("modality_preference_set", { modality, skip_prompt: true });
      } catch (err) {
        console.warn("[NewMatchForm] No se pudo persistir la preferencia de modalidad:", err);
      }
    }
    setArrivedViaSkip(false);
    setStep("players");
  }

  function handleChangeModality() {
    // Override puntual: vuelve al step de modalidad SIN tocar DB
    analytics.track("modality_override_used", { original_modality: modality });
    setArrivedViaSkip(false);
    setStep("modality");
  }

  const excludeIds = [...teamA, ...teamB].map((p) => p.id);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (teamA.length !== teamSize || teamB.length !== teamSize) {
      setError(
        `En ${format === "singles" ? "singles" : "parejas"} cada equipo debe tener ${teamSize} jugador(es).`,
      );
      return;
    }
    setPending(true);
    try {
      const res = await startLiveMatch({
        modality,
        format,
        set_size: setSize,
        target_points: target,
        capicua_bonus: capicua,
        team_a_players: teamA.map((p) => p.id),
        team_b_players: teamB.map((p) => p.id),
        tournament_id: presetTournamentId ?? null,
        // Quick match: si el toggle "amistosa" está ON, no afecta el Elo.
        // Si la partida viene de un torneo, el toggle se ignora — el server
        // hereda tournaments.rated y este flag no llega.
        rated: presetTournamentId ? undefined : !friendly,
      });
      if (!res.ok) {
        setError(res.error);
        setPending(false);
        return;
      }

      analytics.track("match_created", {
        format,
        modality,
        tournament_id: presetTournamentId ?? null,
      });

      if (presetPairingId) {
        const linkRes = await linkMatchToPairing(presetPairingId, res.match_id);
        if (!linkRes.ok) {
          setError(linkRes.error);
          setPending(false);
          return;
        }
      }

      router.push(`/matches/${res.match_id}/live`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setPending(false);
    }
  }

  if (step === "modality") {
    return (
      <div className="space-y-5">
        {/* Modalidad */}
        <section className="card">
          <label className="label mb-2">Modalidad</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.values(MODALIDADES).map((mod) => (
              <label
                key={mod.code}
                className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  modality === mod.code
                    ? "bg-primary/10 border-primary/40"
                    : "bg-surface-2 border-border hover:border-border-strong"
                }`}
              >
                <input
                  type="radio"
                  name="modality"
                  checked={modality === mod.code}
                  onChange={() => applyModality(mod.code)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2 flex-wrap">
                    <span>
                      {mod.flag} {mod.name}
                    </span>
                    {mod.code === defaultModality && (
                      <span className="badge bg-info/15 text-info text-[10px]">
                        tu default
                      </span>
                    )}
                  </div>
                  <div className="text-text-mute text-xs mt-0.5">{mod.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Checkbox "No volver a preguntar" — discreto, sin emphasis */}
          <label className="flex items-center gap-2 mt-4 text-sm text-text-mute cursor-pointer">
            <input
              type="checkbox"
              checked={skipNextTime}
              onChange={(e) => setSkipNextTime(e.target.checked)}
              className="accent-primary"
            />
            No volver a preguntar esta modalidad
          </label>
        </section>

        {/* Parámetros */}
        <section className="card">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Formato</label>
              <div className="flex bg-surface-2 rounded-md p-1 border border-border">
                <button
                  type="button"
                  onClick={() => applyFormat("singles")}
                  className={`flex-1 py-1.5 rounded text-sm ${format === "singles" ? "bg-surface-3" : "text-text-dim"}`}
                >
                  1v1
                </button>
                <button
                  type="button"
                  onClick={() => applyFormat("doubles")}
                  className={`flex-1 py-1.5 rounded text-sm ${format === "doubles" ? "bg-surface-3" : "text-text-dim"}`}
                >
                  2v2
                </button>
              </div>
            </div>
            <div>
              <label className="label">Set de fichas</label>
              <div className="flex bg-surface-2 rounded-md p-1 border border-border">
                <button
                  type="button"
                  disabled={!isCustom}
                  onClick={() => isCustom && setSetSize("d6")}
                  className={`flex-1 py-1.5 rounded text-sm ${setSize === "d6" ? "bg-surface-3" : "text-text-dim"} ${!isCustom ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  6-6
                </button>
                <button
                  type="button"
                  disabled={!isCustom}
                  onClick={() => isCustom && setSetSize("d9")}
                  className={`flex-1 py-1.5 rounded text-sm ${setSize === "d9" ? "bg-surface-3" : "text-text-dim"} ${!isCustom ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  9-9
                </button>
              </div>
            </div>
            <div>
              <label className="label">Puntos meta</label>
              <input
                type="number"
                min={50}
                max={500}
                step={10}
                className="input"
                value={target}
                readOnly={!isCustom}
                onChange={(e) => setTarget(parseInt(e.target.value) || 100)}
              />
            </div>
            <div>
              <label className="label">Capicúa bonus</label>
              <input
                type="number"
                min={0}
                max={100}
                step={5}
                className="input"
                value={capicua}
                readOnly={!isCustom}
                onChange={(e) => setCapicua(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          {!isCustom && (
            <p className="text-text-mute text-xs mt-2">
              Set, puntos y capicúa vienen del preset de la modalidad. Para
              editarlos elige &quot;Personalizado&quot;.
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={handleModalityContinue}
          className="btn-primary w-full"
        >
          Continuar
        </button>
      </div>
    );
  }

  // Step: players
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Badge "Cambiar" cuando se saltó el step de modalidad */}
      {arrivedViaSkip && (
        <div
          className="flex items-center gap-1.5 text-sm text-text-mute"
          data-testid="modality-skip-badge"
        >
          <span>Modalidad: {MODALIDADES[modality]?.name ?? modality}</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={handleChangeModality}
            className="text-primary underline underline-offset-2"
            data-testid="change-modality-btn"
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Equipos */}
      <div className="grid md:grid-cols-2 gap-4">
        <TeamPicker
          label={format === "singles" ? "Tú" : "Equipo A"}
          colorClass="text-teamA"
          size={teamSize}
          players={teamA}
          setPlayers={setTeamA}
          excludeIds={excludeIds}
        />
        <TeamPicker
          label={format === "singles" ? "Oponente" : "Equipo B"}
          colorClass="text-teamB"
          size={teamSize}
          players={teamB}
          setPlayers={setTeamB}
          excludeIds={excludeIds}
        />
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-danger text-sm">
          {error}
        </div>
      )}

      {!presetTournamentId && (
        <label className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-surface-2 cursor-pointer hover:border-border-strong transition-colors">
          <input
            type="checkbox"
            checked={friendly}
            onChange={(e) => setFriendly(e.target.checked)}
            className="accent-primary mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Partida amistosa</div>
            <div className="text-xs text-text-mute mt-0.5">
              No afecta tu ranking ni el de tus oponentes.
            </div>
          </div>
        </label>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep("modality")}
          className="btn-secondary"
        >
          Atrás
        </button>
        <button
          type="submit"
          className="btn-primary flex-1"
          disabled={pending}
        >
          {pending ? "Creando…" : "Iniciar partida en vivo"}
        </button>
      </div>
    </form>
  );
}

function TeamPicker({
  label,
  colorClass,
  size,
  players,
  setPlayers,
  excludeIds,
}: {
  label: string;
  colorClass: string;
  size: number;
  players: Player[];
  setPlayers: (p: Player[]) => void;
  excludeIds: string[];
}) {
  return (
    <section className="card">
      <h3 className={`font-semibold mb-3 ${colorClass}`}>{label}</h3>
      {players.length < size ? (
        <UserSearch
          excludeIds={excludeIds}
          placeholder="Buscar jugador por nombre o @usuario…"
          onSelect={(u) => setPlayers([...players, u as Player])}
        />
      ) : null}
      <div className={`space-y-2 ${players.length < size ? "mt-3" : ""}`}>
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 p-2 bg-surface-2 rounded-md"
          >
            <Avatar player={p as any} size={36} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {p.display_name || p.username}
              </div>
              <div className="text-text-mute text-xs truncate">
                @{p.username}
              </div>
            </div>
            <RatingBadge
              display={p.global_display ?? null}
              games={p.total_games}
              compact
              size="xs"
            />
            <button
              type="button"
              className="text-text-mute hover:text-danger px-2"
              onClick={() => setPlayers(players.filter((x) => x.id !== p.id))}
              aria-label="Quitar"
            >
              ✕
            </button>
          </div>
        ))}
        {Array.from({ length: Math.max(0, size - players.length) }).map(
          (_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center gap-3 p-2 bg-surface-2/40 border border-dashed border-border rounded-md text-text-mute text-sm"
            >
              <div className="w-9 h-9 rounded-full bg-surface-3" />
              <span>Jugador {players.length + i + 1}</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
