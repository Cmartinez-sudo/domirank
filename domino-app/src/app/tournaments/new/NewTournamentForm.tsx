"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import { MODALIDADES, COUNTRIES, type ModalityCode } from "@/lib/modalidades";
import { createTournament } from "@/lib/tournaments";

type PublicUser = { id: string; username: string; display_name: string | null; avatar_url: string | null; country: string | null };

function flag(code: string | null) {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code)?.flag ?? null;
}

export function NewTournamentForm({ currentUser, defaultModality }: { currentUser: PublicUser; defaultModality: ModalityCode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [modality, setModality] = useState<ModalityCode>(defaultModality);
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
      <section className="card space-y-3">
        <div>
          <label className="label">Nombre</label>
          <input className="input" placeholder="Torneo sabatino 🍻" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="label">Visibilidad</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: "private", icon: "🔒", label: "Privada", desc: "Solo los participantes" },
              { v: "friends", icon: "👥", label: "Amigos",  desc: "Tus amigos + participantes" },
              { v: "public",  icon: "🌍", label: "Pública", desc: "Cualquiera la puede ver" },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setVisibility(opt.v)}
                className={`p-3 rounded-md border text-left transition-colors ${
                  visibility === opt.v ? "bg-primary/10 border-primary/40" : "bg-surface-2 border-border hover:border-border-strong"
                }`}
              >
                <div className="font-semibold text-sm">{opt.icon} {opt.label}</div>
                <div className="text-text-mute text-xs mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Modalidad</label>
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
          <label className="flex items-center gap-2 p-2.5 bg-surface-2 border border-border rounded-md cursor-pointer">
            <input type="checkbox" checked={continuous} onChange={(e) => setContinuous(e.target.checked)} />
            <span className="text-sm"><strong>Continua ∞</strong> <span className="text-text-mute block text-xs">Torneo sin fin (jornadas)</span></span>
          </label>
          <label className="flex items-center gap-2 p-2.5 bg-surface-2 border border-border rounded-md cursor-pointer">
            <input type="checkbox" checked={rated} onChange={(e) => setRated(e.target.checked)} />
            <span className="text-sm"><strong>Rankeada</strong> <span className="text-text-mute block text-xs">Afecta el rating global</span></span>
          </label>
        </div>
      </section>

      <section className="card">
        <label className="label mb-2">Participantes (mín. 4)</label>
        <UserSearch
          excludeIds={players.map((p) => p.id)}
          placeholder="Buscar jugador…"
          onSelect={(u) => setPlayers([...players, u as PublicUser])}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 bg-surface-2 rounded-md">
              <Avatar player={p as any} size={32} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{flag(p.country) && <span className="mr-1">{flag(p.country)}</span>}{p.display_name || p.username}</div>
              </div>
              {p.id !== currentUser.id && (
                <button type="button" className="text-text-mute hover:text-danger px-1" onClick={() => setPlayers(players.filter((x) => x.id !== p.id))} aria-label="Quitar">✕</button>
              )}
            </div>
          ))}
        </div>
        <p className="text-text-mute text-xs mt-2">{players.length} seleccionados</p>
      </section>

      {err && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">{err}</div>}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Creando…" : "Crear torneo"}
      </button>
    </form>
  );
}
