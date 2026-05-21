"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import { RatingBadge } from "@/components/RatingBadge";
import { MODALIDADES, type ModalityCode, type SetCode, type FormatCode } from "@/lib/modalidades";
import { startLiveMatch } from "@/lib/live-match";

type Player = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  global_display?: number | null;
  total_games?: number | null;
};

export function NewMatchForm({
  currentUser,
  defaultModality,
}: {
  currentUser: Player;
  defaultModality: ModalityCode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modality, setModality] = useState<ModalityCode>(defaultModality ?? "ven");
  const m = MODALIDADES[modality];
  const isCustom = modality === "custom";

  const [format, setFormat] = useState<FormatCode>(m.format);
  const [setSize, setSetSize] = useState<SetCode>(m.set);
  const [target, setTarget] = useState<number>(m.target);
  const [capicua, setCapicua] = useState<number>(m.capicua);

  const [teamA, setTeamA] = useState<Player[]>([currentUser]);
  const [teamB, setTeamB] = useState<Player[]>([]);

  const teamSize = format === "singles" ? 1 : 2;

  function applyModality(code: ModalityCode) {
    setModality(code);
    if (code !== "custom") {
      const x = MODALIDADES[code];
      setFormat(x.format);
      setSetSize(x.set);
      setTarget(x.target);
      setCapicua(x.capicua);
      // Trim teams si bajamos a singles
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

  const excludeIds = [...teamA, ...teamB].map((p) => p.id);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (teamA.length !== teamSize || teamB.length !== teamSize) {
      setError(`En ${format === "singles" ? "singles" : "parejas"} cada equipo debe tener ${teamSize} jugador(es).`);
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
        tournament_id: null,
      });
      if (res.ok) {
        router.push(`/matches/${res.match_id}/live`);
        router.refresh();
      } else {
        setError(res.error);
        setPending(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
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
                  <span>{mod.flag} {mod.name}</span>
                  {mod.code === defaultModality && (
                    <span className="badge bg-info/15 text-info text-[10px]">tu default</span>
                  )}
                </div>
                <div className="text-text-mute text-xs mt-0.5">{mod.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Parámetros */}
      <section className="card">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Formato</label>
            <div className="flex bg-surface-2 rounded-md p-1 border border-border">
              <button type="button" onClick={() => applyFormat("singles")} className={`flex-1 py-1.5 rounded text-sm ${format === "singles" ? "bg-surface-3" : "text-text-dim"}`}>1v1</button>
              <button type="button" onClick={() => applyFormat("doubles")} className={`flex-1 py-1.5 rounded text-sm ${format === "doubles" ? "bg-surface-3" : "text-text-dim"}`}>2v2</button>
            </div>
          </div>
          <div>
            <label className="label">Set de fichas</label>
            <div className="flex bg-surface-2 rounded-md p-1 border border-border">
              <button type="button" disabled={!isCustom} onClick={() => isCustom && setSetSize("d6")} className={`flex-1 py-1.5 rounded text-sm ${setSize === "d6" ? "bg-surface-3" : "text-text-dim"} ${!isCustom ? "opacity-60 cursor-not-allowed" : ""}`}>6-6</button>
              <button type="button" disabled={!isCustom} onClick={() => isCustom && setSetSize("d9")} className={`flex-1 py-1.5 rounded text-sm ${setSize === "d9" ? "bg-surface-3" : "text-text-dim"} ${!isCustom ? "opacity-60 cursor-not-allowed" : ""}`}>9-9</button>
            </div>
          </div>
          <div>
            <label className="label">Puntos meta</label>
            <input
              type="number" min={50} max={500} step={10}
              className="input" value={target}
              readOnly={!isCustom}
              onChange={(e) => setTarget(parseInt(e.target.value) || 100)}
            />
          </div>
          <div>
            <label className="label">Capicúa bonus</label>
            <input
              type="number" min={0} max={100} step={5}
              className="input" value={capicua}
              readOnly={!isCustom}
              onChange={(e) => setCapicua(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
        {!isCustom && (
          <p className="text-text-mute text-xs mt-2">Set, puntos y capicúa vienen del preset de la modalidad. Para editarlos elige “Personalizado”.</p>
        )}
      </section>

      {/* Equipos con búsqueda — cualquier jugador puede ser agregado.
          La confianza viene del attestation system: al cerrar partida,
          se necesitan 3 de 4 firmas para que afecte el rating. */}
      <div className="grid md:grid-cols-2 gap-4">
        <TeamPicker label={format === "singles" ? "Tú" : "Equipo A"} colorClass="text-teamA" size={teamSize} players={teamA} setPlayers={setTeamA} excludeIds={excludeIds} />
        <TeamPicker label={format === "singles" ? "Oponente" : "Equipo B"} colorClass="text-teamB" size={teamSize} players={teamB} setPlayers={setTeamB} excludeIds={excludeIds} />
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-danger text-sm">
          {error}
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Creando…" : "Iniciar partida en vivo"}
      </button>
    </form>
  );
}

function TeamPicker({
  label, colorClass, size, players, setPlayers, excludeIds,
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
          <div key={p.id} className="flex items-center gap-3 p-2 bg-surface-2 rounded-md">
            <Avatar player={p as any} size={36} />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{p.display_name || p.username}</div>
              <div className="text-text-mute text-xs truncate">@{p.username}</div>
            </div>
            <RatingBadge display={p.global_display ?? null} games={p.total_games} compact size="xs" />
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
        {Array.from({ length: Math.max(0, size - players.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="flex items-center gap-3 p-2 bg-surface-2/40 border border-dashed border-border rounded-md text-text-mute text-sm">
            <div className="w-9 h-9 rounded-full bg-surface-3" />
            <span>Jugador {players.length + i + 1}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
