"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import { RatingBadge } from "@/components/RatingBadge";
import { MODALIDADES, type ModalityCode } from "@/lib/modalidades";
import { createTournament } from "@/lib/tournaments";
import { TOURNAMENT_FORMATS, FORMAT_LIST, type TournamentFormat } from "@/lib/tournament-formats";

type PublicUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  global_display?: number | null;
  total_games?: number | null;
};

export function NewTournamentForm({ currentUser, defaultModality }: { currentUser: PublicUser; defaultModality: ModalityCode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [modality, setModality] = useState<ModalityCode>(defaultModality);
  const [format, setFormat] = useState<TournamentFormat>("rotation");
  const [expandedFormat, setExpandedFormat] = useState<TournamentFormat | null>(null);
  const [visibility, setVisibility] = useState<"public" | "private" | "friends">("private");
  const m = MODALIDADES[modality];
  const [pointsToWin, setPointsToWin] = useState<number>(m.target);
  const [rounds, setRounds] = useState<number>(0);
  const [continuous, setContinuous] = useState(false);
  const [rated, setRated] = useState(true);
  const [players, setPlayers] = useState<PublicUser[]>([currentUser]);

  function pickModality(code: ModalityCode) {
    setModality(code);
    if (code !== "custom") setPointsToWin(MODALIDADES[code].target);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) return setErr("Pon un nombre al torneo.");
    if (players.length < 4) return setErr("Necesitas al menos 4 jugadores (te contamos a ti).");

    setPending(true);
    try {
      const r = await createTournament({
        name: name.trim(),
        visibility,
        modality,
        format,
        points_to_win: pointsToWin,
        rounds,
        continuous,
        rated,
        player_ids: players.map((p) => p.id),
      });
      if (r.ok) {
        router.push(`/tournaments/${r.tournament_id}`);
        router.refresh();
      } else {
        setErr(r.error);
        setPending(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Nombre */}
      <section className="card space-y-3">
        <div>
          <label className="label">Nombre</label>
          <input className="input" placeholder="Torneo sabatino 🍻" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {/* Visibilidad */}
        <div>
          <label className="label">Visibilidad</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: "private", icon: "🔒", label: "Privada", desc: "Solo participantes" },
              { v: "friends", icon: "👥", label: "Amigos",  desc: "Tus amigos" },
              { v: "public",  icon: "🌍", label: "Pública", desc: "Cualquiera" },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setVisibility(opt.v)}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  visibility === opt.v ? "bg-primary/10 border-primary/40" : "bg-surface-2 border-border hover:border-border-strong"
                }`}
              >
                <div className="font-semibold text-sm">{opt.icon} {opt.label}</div>
                <div className="text-text-mute text-xs mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Formato del torneo */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <label className="label mb-0">Formato del torneo</label>
          <Link
            href="/tournaments/formatos"
            target="_blank"
            className="text-xs text-primary hover:underline"
          >
            ¿Cómo elegir? →
          </Link>
        </div>
        <div className="space-y-2">
          {FORMAT_LIST.map((f) => {
            const isSelected = format === f.code;
            const isExpanded = expandedFormat === f.code;
            return (
              <div
                key={f.code}
                className={`border rounded-xl transition-colors overflow-hidden ${
                  isSelected ? "border-primary/50 bg-primary/5" : "border-border bg-surface-2"
                }`}
              >
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                  onClick={() => {
                    setFormat(f.code);
                    setExpandedFormat(isExpanded ? null : f.code);
                  }}
                >
                  <span className="text-xl">{f.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${isSelected ? "text-primary" : ""}`}>{f.name}</span>
                      {f.autopairing && <span className="badge bg-surface-3 text-text-mute text-[9px]">Auto-pareo</span>}
                    </div>
                    <div className="text-text-mute text-xs truncate">{f.short}</div>
                  </div>
                  {isSelected && <span className="text-primary text-sm shrink-0">✓</span>}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2 text-sm border-t border-border/50">
                    <p className="text-text-dim text-xs mt-2">{f.description}</p>
                    <div className="flex items-center gap-2 text-xs text-text-mute">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className={`w-4 h-1 rounded-full ${i < f.fairness ? "bg-primary" : "bg-surface-3"}`} />
                        ))}
                      </div>
                      <span>justicia · {f.minPlayers}-{f.maxPlayers} jugadores · {f.durationHint}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Modalidad de juego */}
      <section className="card space-y-3">
        <div>
          <label className="label">Modalidad de juego</label>
          <select className="input" value={modality} onChange={(e) => pickModality(e.target.value as ModalityCode)}>
            {Object.values(MODALIDADES).map((mm) => (
              <option key={mm.code} value={mm.code}>{mm.flag} {mm.name} · {mm.desc}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Puntos por partida</label>
            <input type="number" min={50} max={500} step={10} className="input" value={pointsToWin} onChange={(e) => setPointsToWin(parseInt(e.target.value) || 100)} />
          </div>
          <div>
            <label className="label">Vueltas (0 = sin límite)</label>
            <input type="number" min={0} max={200} className="input" value={rounds} onChange={(e) => setRounds(parseInt(e.target.value) || 0)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 p-3 bg-surface-2 border border-border rounded-xl cursor-pointer">
            <input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} />
            <span className="text-sm"><strong>Continua ∞</strong> <span className="text-text-mute block text-xs">Sin rondas definidas</span></span>
          </label>
          <label className="flex items-center gap-2 p-3 bg-surface-2 border border-border rounded-xl cursor-pointer">
            <input type="checkbox" checked={rated} onChange={(e) => setRated(e.target.checked)} />
            <span className="text-sm"><strong>Rankeada</strong> <span className="text-text-mute block text-xs">Afecta rating global</span></span>
          </label>
        </div>
      </section>

      {/* Participantes */}
      <section className="card">
        <label className="label mb-2">Participantes (mín. 4)</label>
        <UserSearch
          excludeIds={players.map((p) => p.id)}
          placeholder="Buscar jugador por nombre o @usuario…"
          onSelect={(u) => setPlayers([...players, u as PublicUser])}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 bg-surface-2 rounded-xl">
              <Avatar player={p as any} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{p.display_name || p.username}</div>
              </div>
              <RatingBadge display={p.global_display ?? null} games={p.total_games} compact size="xs" />
              {p.id !== currentUser.id && (
                <button type="button" className="text-text-mute hover:text-danger px-1 min-h-[36px]" onClick={() => setPlayers(players.filter((x) => x.id !== p.id))} aria-label="Quitar">✕</button>
              )}
            </div>
          ))}
        </div>
        <p className="text-text-mute text-xs mt-2">{players.length} seleccionados</p>
      </section>

      {err && <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm">{err}</div>}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Creando…" : "Crear torneo"}
      </button>
    </form>
  );
}
