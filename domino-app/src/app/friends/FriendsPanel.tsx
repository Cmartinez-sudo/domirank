"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import { COUNTRIES } from "@/lib/modalidades";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  unfriend,
} from "@/lib/friends";

type PublicUser = { id: string; username: string; display_name: string | null; avatar_url: string | null; country: string | null };
type IncomingReq = { id: string; message: string | null; created_at: string; from: PublicUser };
type OutgoingReq = { id: string; created_at: string; to: PublicUser };

function flag(code: string | null) {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code)?.flag ?? null;
}

export function FriendsPanel({
  friends,
  incoming,
  outgoing,
}: {
  friends: PublicUser[];
  incoming: IncomingReq[];
  outgoing: OutgoingReq[];
}) {
  const [tab, setTab] = useState<"friends" | "incoming" | "outgoing">("friends");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const tabBtn = (id: typeof tab, label: string, badge?: number) => (
    <button
      onClick={() => setTab(id)}
      className={`flex-1 px-3 py-2 rounded text-sm transition-colors ${
        tab === id ? "bg-surface-3 text-text" : "text-text-dim hover:text-text"
      }`}
    >
      {label} {badge !== undefined && badge > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary/20 text-primary text-xs font-semibold">{badge}</span>}
    </button>
  );

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    setBusy(true);
    try {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Amigos</h1>

      <section className="card">
        <h2 className="text-sm font-semibold mb-2 text-text-dim uppercase tracking-wider">Agregar amigo</h2>
        <UserSearch
          excludeIds={[...friends.map((f) => f.id), ...outgoing.map((r) => r.to.id), ...incoming.map((r) => r.from.id)]}
          placeholder="Buscar por @usuario o nombre…"
          onSelect={(u) => run(() => sendFriendRequest(u.id))}
        />
        <p className="text-text-mute text-xs mt-2">Al elegir un usuario le enviamos una solicitud. Cuando acepte, podrán ver perfiles, partidas y torneos mutuamente.</p>
      </section>

      <div className="flex gap-1 bg-surface rounded-md p-1 border border-border">
        {tabBtn("friends", "Mis amigos", friends.length)}
        {tabBtn("incoming", "Recibidas", incoming.length)}
        {tabBtn("outgoing", "Enviadas", outgoing.length)}
      </div>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
          {error}
        </div>
      )}

      {tab === "friends" && (
        <div className="space-y-2">
          {friends.length === 0 && <Empty msg="Aún no tienes amigos. Búscalos arriba." />}
          {friends.map((f) => (
            <UserRow key={f.id} user={f}>
              <button
                className="btn-ghost btn-sm text-danger"
                disabled={busy}
                onClick={() => {
                  if (confirm(`¿Quitar a @${f.username} de tus amigos?`)) run(() => unfriend(f.id));
                }}
              >
                Quitar
              </button>
            </UserRow>
          ))}
        </div>
      )}

      {tab === "incoming" && (
        <div className="space-y-2">
          {incoming.length === 0 && <Empty msg="Sin solicitudes pendientes." />}
          {incoming.map((r) => (
            <UserRow key={r.id} user={r.from}>
              <div className="flex gap-2">
                <button className="btn-primary text-sm py-1.5 px-3" disabled={busy} onClick={() => run(() => acceptFriendRequest(r.id))}>
                  Aceptar
                </button>
                <button className="btn-ghost text-sm py-1.5 px-3" disabled={busy} onClick={() => run(() => rejectFriendRequest(r.id))}>
                  Rechazar
                </button>
              </div>
            </UserRow>
          ))}
        </div>
      )}

      {tab === "outgoing" && (
        <div className="space-y-2">
          {outgoing.length === 0 && <Empty msg="Sin solicitudes enviadas." />}
          {outgoing.map((r) => (
            <UserRow key={r.id} user={r.to}>
              <button className="btn-ghost text-sm py-1.5 px-3" disabled={busy} onClick={() => run(() => cancelFriendRequest(r.id))}>
                Cancelar
              </button>
            </UserRow>
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, children }: { user: PublicUser; children: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-3 py-3">
      <Link href={`/profile/${user.username}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar player={user as any} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">
            {flag(user.country) && <span className="mr-1.5">{flag(user.country)}</span>}
            {user.display_name || user.username}
          </div>
          <div className="text-text-mute text-xs truncate">@{user.username}</div>
        </div>
      </Link>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="card text-center text-text-mute py-8">{msg}</div>;
}
