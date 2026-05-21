"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { UserSearch } from "@/components/UserSearch";
import { RatingBadge } from "@/components/RatingBadge";
import { PageTransition } from "@/components/Motion";
import { useToast } from "@/components/Toast";
import {
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  unfriend,
} from "@/lib/friends";

type FriendUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  global_display: number | null;
  total_games: number | null;
  total_wins: number | null;
  total_losses: number | null;
  last_match_at: string | null;
};

type IncomingReq = { id: string; message: string | null; created_at: string; from: FriendUser };
type OutgoingReq = { id: string; created_at: string; to: FriendUser };

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const sec = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return "ahora";
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.round(hr / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function FriendsPanel({
  friends,
  incoming,
  outgoing,
}: {
  friends: FriendUser[];
  incoming: IncomingReq[];
  outgoing: OutgoingReq[];
}) {
  const [tab, setTab] = useState<"friends" | "incoming" | "outgoing">("friends");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

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

  const run = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(okMsg);
    router.refresh();
  };

  return (
    <PageTransition>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold">Amigos</h1>
        </div>

        {/* Buscar usuarios — navega al perfil al click */}
        <section className="card">
          <h2 className="text-sm font-semibold mb-2 text-text-dim uppercase tracking-wider">Encontrar jugadores</h2>
          <UserSearch
            placeholder="Buscar por @usuario o nombre…"
            onSelect={(u) => router.push(`/profile/${u.username}`)}
          />
          <p className="text-text-mute text-xs mt-2">
            Toca un jugador para ver su perfil y agregarlo como amigo desde ahí.
          </p>
        </section>

        <div className="flex gap-1 bg-surface rounded-md p-1 border border-border">
          {tabBtn("friends", "Mis amigos", friends.length)}
          {tabBtn("incoming", "Recibidas", incoming.length)}
          {tabBtn("outgoing", "Enviadas", outgoing.length)}
        </div>

        {tab === "friends" && (
          <div className="space-y-3">
            {friends.length === 0 && (
              <EmptyCard
                icon="🤝"
                title="Aún no tienes amigos"
                body="Busca jugadores arriba y mándales solicitud desde su perfil."
              />
            )}
            {friends.map((f) => (
              <FriendCard
                key={f.id}
                friend={f}
                busy={busy}
                onUnfriend={() => {
                  if (confirm(`¿Quitar a @${f.username} de tus amigos?`)) {
                    run(() => unfriend(f.id), "Ya no son amigos");
                  }
                }}
              />
            ))}
          </div>
        )}

        {tab === "incoming" && (
          <div className="space-y-2">
            {incoming.length === 0 && (
              <EmptyCard
                icon="📭"
                title="Sin solicitudes pendientes"
                body="Cuando alguien te mande solicitud de amistad, aparecerá aquí."
              />
            )}
            {incoming.map((r) => (
              <RequestRow
                key={r.id}
                user={r.from}
                meta={`Hace ${relTime(r.created_at)}`}
                primary={{
                  label: "Aceptar",
                  busy,
                  onClick: () => run(() => acceptFriendRequest(r.id), `Ahora son amigos`),
                }}
                secondary={{
                  label: "Rechazar",
                  busy,
                  onClick: () => run(() => rejectFriendRequest(r.id), "Solicitud rechazada"),
                }}
              />
            ))}
          </div>
        )}

        {tab === "outgoing" && (
          <div className="space-y-2">
            {outgoing.length === 0 && (
              <EmptyCard
                icon="📤"
                title="No has enviado solicitudes"
                body="Encuentra jugadores arriba y mándales solicitud desde su perfil."
              />
            )}
            {outgoing.map((r) => (
              <RequestRow
                key={r.id}
                user={r.to}
                meta={`Enviada hace ${relTime(r.created_at)}`}
                secondary={{
                  label: "Cancelar",
                  busy,
                  onClick: () => run(() => cancelFriendRequest(r.id), "Solicitud cancelada"),
                }}
              />
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

/* ===================== Sub-componentes ===================== */

function FriendCard({
  friend,
  busy,
  onUnfriend,
}: {
  friend: FriendUser;
  busy: boolean;
  onUnfriend: () => void;
}) {
  const wins   = friend.total_wins   ?? 0;
  const losses = friend.total_losses ?? 0;
  const games  = friend.total_games  ?? (wins + losses);
  const winRate = games > 0 ? Math.round((wins / games) * 100) : null;

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <Link href={`/profile/${friend.username}`} className="shrink-0">
          <Avatar player={friend as any} size={56} />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <Link href={`/profile/${friend.username}`} className="hover:text-primary">
              <div className="font-semibold truncate">{friend.display_name || friend.username}</div>
              <div className="text-text-mute text-xs truncate">@{friend.username}</div>
            </Link>
            <RatingBadge
              display={friend.global_display ?? null}
              games={friend.total_games}
              compact
              size="sm"
            />
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-text-dim">
            <span><span className="text-primary font-mono font-semibold">{wins}</span>G</span>
            <span><span className="text-danger font-mono font-semibold">{losses}</span>P</span>
            <span>·</span>
            <span>{games} {games === 1 ? "partida" : "partidas"}</span>
            {winRate !== null && (
              <>
                <span>·</span>
                <span className={winRate >= 50 ? "text-primary" : "text-text-mute"}>{winRate}%</span>
              </>
            )}
          </div>

          {friend.last_match_at && (
            <div className="text-text-mute text-xs mt-1">
              Última partida: {relTime(friend.last_match_at)}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Link
              href={`/profile/${friend.username}`}
              className="btn-ghost text-sm py-1.5 px-3"
            >
              Ver perfil
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={onUnfriend}
              className="text-text-mute hover:text-danger text-xs underline-offset-2 hover:underline ml-auto"
              aria-label={`Quitar a ${friend.username} de amigos`}
            >
              Quitar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestRow({
  user,
  meta,
  primary,
  secondary,
}: {
  user: FriendUser;
  meta: string;
  primary?: { label: string; busy: boolean; onClick: () => void };
  secondary: { label: string; busy: boolean; onClick: () => void };
}) {
  return (
    <div className="card flex items-center gap-3 py-3">
      <Link href={`/profile/${user.username}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar player={user as any} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{user.display_name || user.username}</div>
          <div className="text-text-mute text-xs truncate">@{user.username} · {meta}</div>
        </div>
        <RatingBadge display={user.global_display ?? null} games={user.total_games} compact size="xs" />
      </Link>
      <div className="flex gap-2 shrink-0">
        {primary && (
          <button
            type="button"
            disabled={primary.busy}
            onClick={primary.onClick}
            className="btn-primary text-sm py-1.5 px-3"
          >
            {primary.label}
          </button>
        )}
        <button
          type="button"
          disabled={secondary.busy}
          onClick={secondary.onClick}
          className="btn-ghost text-sm py-1.5 px-3 text-text-mute hover:text-danger"
        >
          {secondary.label}
        </button>
      </div>
    </div>
  );
}

function EmptyCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="card text-center py-8">
      <div className="text-4xl mb-3 select-none">{icon}</div>
      <div className="font-semibold mb-1">{title}</div>
      <p className="text-text-mute text-sm max-w-xs mx-auto">{body}</p>
    </div>
  );
}
