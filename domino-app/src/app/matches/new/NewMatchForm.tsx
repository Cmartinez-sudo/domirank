"use client";

/**
 * Wizard de nueva partida — 2 pasos (Layout 2):
 *   Step 1 (CONFIG):  count_rule (2 tiles) + chips de preset + selectores meta/capicúa.
 *   Step 2 (PLAYERS): armado de equipos + badge "Cambiar" si se saltó el step 1.
 *
 * Skip flow:
 *   Si preferences.skip_modality_prompt === true y los 4 defaults del user
 *   están presentes (count_rule + set + target + capicúa), se monta directo
 *   en step PLAYERS con esos 4 valores. Legacy fallback: si solo hay
 *   default_match_modality legacy, se deriva.
 *
 * Post-retiro d9: set_size no se muestra en la UI ni se elige. Inserts nuevos
 * salen con set_size='d6'. La columna sigue en DB por retrocompat de históricos.
 */

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import { RatingBadge } from "@/components/RatingBadge";
import {
  COUNT_RULES,
  PRESETS,
  countRuleFromLegacyModality,
  matchPreset,
  presetById,
  presetsForCountRule,
  type CountRule,
  type ModalityCode,
  type PresetId,
  type SetCode,
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

type Step = "config" | "players";

/**
 * Deriva la configuración inicial (count_rule + 3 valores) desde las prefs
 * del user, con fallback al preset por defecto que le llega como prop.
 */
function deriveInitialConfig(
  prefs: UserPreferences | null | undefined,
  fallbackPreset: PresetId,
): {
  countRule: CountRule;
  setSize: SetCode;
  target: number;
  capicua: number;
  fromPrefs: boolean;
} {
  const p = prefs;
  if (
    p?.default_count_rule &&
    p?.default_target_points != null &&
    p?.default_capicua_bonus != null
  ) {
    return {
      countRule: p.default_count_rule,
      setSize: (p.default_set_size as SetCode | null) ?? "d6",
      target: p.default_target_points,
      capicua: p.default_capicua_bonus,
      fromPrefs: true,
    };
  }
  // Legacy fallback: usar default_match_modality si existe.
  if (p?.default_match_modality) {
    const legacy = p.default_match_modality;
    return {
      countRule: countRuleFromLegacyModality(legacy),
      setSize: legacy === "cub" ? "d9" : "d6",
      target:
        legacy === "ven" ? 100
        : legacy === "dom" ? 200
        : legacy === "cub" ? 150
        : legacy === "pri" ? 200
        : 100,
      capicua: legacy === "pri" ? 50 : 30,
      fromPrefs: true,
    };
  }
  const preset = PRESETS[fallbackPreset];
  return {
    countRule: preset.countRule,
    setSize: preset.set,
    target: preset.target,
    capicua: preset.capicua,
    fromPrefs: false,
  };
}

export function NewMatchForm({
  currentUser,
  defaultPreset,
  initialPreferences,
  frequentPlayers = [],
}: {
  currentUser: Player;
  defaultPreset: PresetId;
  initialPreferences?: UserPreferences | null;
  frequentPlayers?: Player[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetTournamentId = searchParams.get("tournament");
  const presetPairingId = searchParams.get("pairing");

  const { preferences, update } = useUserPreferences(initialPreferences);
  const activePrefs = preferences ?? initialPreferences ?? null;

  const initialConfig = deriveInitialConfig(activePrefs, defaultPreset);

  const shouldSkipConfig =
    activePrefs?.skip_modality_prompt === true && initialConfig.fromPrefs;

  const hasInconsistentPreferences =
    activePrefs?.skip_modality_prompt === true && !initialConfig.fromPrefs;

  if (hasInconsistentPreferences) {
    console.warn(
      "[NewMatchForm] skip_modality_prompt=true sin defaults completos. Flow normal.",
    );
  }

  const [step, setStep] = useState<Step>(shouldSkipConfig ? "players" : "config");
  const [arrivedViaSkip, setArrivedViaSkip] = useState(shouldSkipConfig);

  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const [countRule, setCountRule] = useState<CountRule>(initialConfig.countRule);
  const [setSize] = useState<SetCode>(initialConfig.setSize); // set_size fijo — d9 fuera del menú
  const [target, setTarget] = useState<number>(initialConfig.target);
  const [capicua, setCapicua] = useState<number>(initialConfig.capicua);

  // Preset seleccionado explícitamente (chip). null = "Personalizado" implícito
  // cuando los 4 valores no coinciden con ningún preset nombrado.
  const initialPresetId = matchPreset({
    count_rule: initialConfig.countRule,
    set_size: initialConfig.setSize,
    target_points: initialConfig.target,
    capicua_bonus: initialConfig.capicua,
  })?.id ?? null;
  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(initialPresetId);

  const [teamA, setTeamA] = useState<Player[]>([currentUser]);
  const [teamB, setTeamB] = useState<Player[]>([]);
  const teamSize = 2;

  const [friendly, setFriendly] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (arrivedViaSkip) {
      analytics.track("modality_step_skipped", {
        count_rule: countRule,
        preset_id: selectedPreset ?? "personalizado",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(id: PresetId) {
    const p = PRESETS[id];
    setSelectedPreset(id);
    setCountRule(p.countRule);
    setTarget(p.target);
    setCapicua(p.capicua);
  }

  function switchCountRule(next: CountRule) {
    if (next === countRule) return;
    setCountRule(next);
    // Cambiar de regla deselecciona el preset (los otros valores se mantienen).
    setSelectedPreset(null);
  }

  function editTarget(next: number) {
    setTarget(next);
    setSelectedPreset(null);
  }

  function editCapicua(next: number) {
    setCapicua(next);
    setSelectedPreset(null);
  }

  const presetLabel =
    matchPreset({ count_rule: countRule, set_size: setSize, target_points: target, capicua_bonus: capicua })?.title
    ?? "Personalizado";

  async function handleConfigContinue() {
    if (saveAsDefault) {
      try {
        await update({
          default_count_rule: countRule,
          default_set_size: setSize,
          default_target_points: target,
          default_capicua_bonus: capicua,
          skip_modality_prompt: true,
        });
        analytics.track("modality_preference_set", {
          count_rule: countRule,
          preset_id: selectedPreset ?? "personalizado",
          skip_prompt: true,
        });
      } catch (err) {
        console.warn("[NewMatchForm] No se pudo persistir la preferencia:", err);
      }
    }
    setArrivedViaSkip(false);
    setStep("players");
  }

  function handleChangeConfig() {
    analytics.track("modality_override_used", {
      count_rule: countRule,
      preset_id: selectedPreset ?? "personalizado",
    });
    setArrivedViaSkip(false);
    setStep("config");
  }

  const excludeIds = [...teamA, ...teamB].map((p) => p.id);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (teamA.length !== teamSize || teamB.length !== teamSize) {
      setError(`Cada equipo debe tener ${teamSize} jugadores.`);
      return;
    }
    setPending(true);
    try {
      const res = await startLiveMatch({
        count_rule: countRule,
        format: "doubles",
        set_size: setSize,
        target_points: target,
        capicua_bonus: capicua,
        team_a_players: teamA.map((p) => p.id),
        team_b_players: teamB.map((p) => p.id),
        tournament_id: presetTournamentId ?? null,
        rated: presetTournamentId ? undefined : !friendly,
      });
      if (!res.ok) {
        setError(res.error);
        setPending(false);
        return;
      }

      analytics.track("match_created", {
        format: "doubles",
        count_rule: countRule,
        preset_id: selectedPreset ?? "personalizado",
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

  if (step === "config") {
    const availablePresets = presetsForCountRule(countRule);
    return (
      <div className="space-y-5">
        {/* Regla de conteo — 2 tarjetas grandes */}
        <section className="card">
          <label className="label mb-2">Modalidad de juego</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.values(COUNT_RULES)).map((rule) => (
              <button
                key={rule.code}
                type="button"
                onClick={() => switchCountRule(rule.code)}
                className={`flex flex-col items-start gap-2 p-4 rounded-md border text-left transition-colors ${
                  countRule === rule.code
                    ? "bg-primary/10 border-primary/60"
                    : "bg-surface-2 border-border hover:border-border-strong"
                }`}
                aria-pressed={countRule === rule.code}
                data-testid={`count-rule-${rule.code}`}
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={rule.icon}
                    alt=""
                    width={40}
                    height={40}
                    aria-hidden="true"
                  />
                  <div className="font-semibold text-base">{rule.name}</div>
                </div>
                <div className="text-text-mute text-xs">{rule.subtitle}</div>
                <div className="text-text-dim text-xs italic">{rule.blurb}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Presets como atajos filtrados por count_rule */}
        <section className="card">
          <div className="flex items-baseline justify-between mb-2">
            <label className="label mb-0">Preset</label>
            <span className="text-text-mute text-xs">
              {selectedPreset ? PRESETS[selectedPreset].title : "Personalizado"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedPreset === p.id
                    ? "bg-primary/15 border-primary/60 text-primary"
                    : "bg-surface-2 border-border text-text-dim hover:border-border-strong"
                }`}
                aria-pressed={selectedPreset === p.id}
                data-testid={`preset-${p.id}`}
              >
                {p.title}
              </button>
            ))}
          </div>
          {availablePresets[0]?.noteCountry && (
            <p className="text-text-mute text-xs mt-2">
              Toca un preset para precargar meta y capicúa.
            </p>
          )}
        </section>

        {/* Selectores meta/capicúa siempre visibles */}
        <section className="card">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="target-points">Puntos meta</label>
              <input
                id="target-points"
                type="number"
                min={50}
                max={500}
                step={10}
                className="input"
                value={target}
                onChange={(e) => editTarget(parseInt(e.target.value) || 100)}
              />
            </div>
            <div>
              <label className="label" htmlFor="capicua-bonus">Capicúa bonus</label>
              <input
                id="capicua-bonus"
                type="number"
                min={0}
                max={100}
                step={5}
                className="input"
                value={capicua}
                onChange={(e) => editCapicua(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <p className="text-text-mute text-xs mt-2">
            Edita cualquier valor y el preset se marcará como Personalizado.
          </p>
        </section>

        <label className="flex items-center gap-2 text-sm text-text-mute cursor-pointer">
          <input
            type="checkbox"
            checked={saveAsDefault}
            onChange={(e) => setSaveAsDefault(e.target.checked)}
            className="accent-primary"
          />
          Guardar esta configuración como mi partida por defecto
        </label>

        <button
          type="button"
          onClick={handleConfigContinue}
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
      {arrivedViaSkip && (
        <div
          className="flex items-center gap-1.5 text-sm text-text-mute"
          data-testid="modality-skip-badge"
        >
          <span>
            {COUNT_RULES[countRule].name} · {presetLabel} · {target} pts
          </span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={handleChangeConfig}
            className="text-primary underline underline-offset-2"
            data-testid="change-modality-btn"
          >
            Cambiar
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <TeamPicker
          label="Equipo A"
          colorClass="text-teamA"
          size={teamSize}
          players={teamA}
          setPlayers={setTeamA}
          excludeIds={excludeIds}
          frequentPlayers={frequentPlayers}
        />
        <TeamPicker
          label="Equipo B"
          colorClass="text-teamB"
          size={teamSize}
          players={teamB}
          setPlayers={setTeamB}
          excludeIds={excludeIds}
          frequentPlayers={frequentPlayers}
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
          onClick={() => setStep("config")}
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
  frequentPlayers,
}: {
  label: string;
  colorClass: string;
  size: number;
  players: Player[];
  setPlayers: (p: Player[]) => void;
  excludeIds: string[];
  frequentPlayers: Player[];
}) {
  const availableQuickPicks = frequentPlayers.filter(
    (p) => !excludeIds.includes(p.id),
  );
  return (
    <section className="card">
      <h3 className={`font-semibold mb-3 ${colorClass}`}>{label}</h3>
      {players.length < size ? (
        <>
          <UserSearch
            excludeIds={excludeIds}
            placeholder="Buscar jugador por nombre o @usuario…"
            onSelect={(u) => setPlayers([...players, u as Player])}
          />
          {availableQuickPicks.length > 0 && (
            <div className="mt-3">
              <div className="text-text-mute text-xs uppercase tracking-wider mb-1.5">
                Con quien juegas seguido
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableQuickPicks.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlayers([...players, p])}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-surface-2 border border-border hover:border-primary/60 text-xs transition-colors"
                  >
                    <Avatar player={p as any} size={20} />
                    <span className="max-w-[100px] truncate">
                      {(p.display_name || p.username).split(" ")[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
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

// Legacy types re-exported for compat — some callers still import them.
export type { ModalityCode };
