"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGroup } from "@/lib/groups";

export function NewGroupForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allowFriendlies, setAllowFriendlies] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      setError("El nombre debe tener entre 2 y 60 caracteres.");
      return;
    }

    startTransition(async () => {
      const r = await createGroup({
        name: trimmedName,
        description: description.trim() || undefined,
        allowFriendlies,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.data) {
        router.push(`/groups/${r.data.groupId}/members`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="card space-y-4">
        <div>
          <label htmlFor="group-name" className="label block mb-1.5">
            Nombre del grupo
          </label>
          <input
            id="group-name"
            type="text"
            className="input"
            placeholder="Los Jueves Casa de Juan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="off"
            autoFocus
            required
          />
          <p className="text-text-mute text-xs mt-1">{name.length}/60</p>
        </div>

        <div>
          <label htmlFor="group-desc" className="label block mb-1.5">
            Descripción <span className="text-text-mute font-normal">(opcional)</span>
          </label>
          <textarea
            id="group-desc"
            className="input min-h-[80px] resize-y"
            placeholder="Crew que juega los jueves después del trabajo."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
          <p className="text-text-mute text-xs mt-1">{description.length}/500</p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={allowFriendlies}
            onChange={(e) => setAllowFriendlies(e.target.checked)}
            className="accent-primary mt-1"
          />
          <div className="flex-1">
            <div className="font-semibold text-sm">Contar partidas amistosas</div>
            <div className="text-text-mute text-xs mt-0.5">
              Si está activo, las partidas marcadas como amistosas (que no
              afectan el Elo global) también suman en el leaderboard del grupo.
              Recomendado para grupos casuales.
            </div>
          </div>
        </label>
      </section>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded-md text-danger text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => history.back()}
          className="btn-secondary"
          disabled={pending}
        >
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? "Creando…" : "Crear grupo"}
        </button>
      </div>
    </form>
  );
}
