"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { BellOffIcon } from "@/components/icons";
import { acceptFriendRequest, rejectFriendRequest } from "@/lib/friends";
import type { AppNotification } from "@/lib/notifications-types";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

function relTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const sec = Math.max(1, Math.round((now - t) / 1000));
  if (sec < 60) return "ahora";
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.round(hr / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function NotificationsList({ items }: { items: AppNotification[] }) {
  if (items.length === 0) return <EmptyState />;

  return (
    <div className="space-y-2">
      {items.map((n, i) => (
        <motion.div
          key={n.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2), ease: EASE_OUT }}
        >
          <NotificationCard n={n} />
        </motion.div>
      ))}
    </div>
  );
}

function NotificationCard({ n }: { n: AppNotification }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [acted, setActed]     = useState<"accepted" | "rejected" | null>(null);

  const actorName = n.actor?.display_name || n.actor?.username || "alguien";
  const actorUsername = n.actor?.username;

  let body: React.ReactNode = null;
  let inline: React.ReactNode = null;
  let href: string | null = null;

  const matchHref = n.ref_match_id ? `/matches/${n.ref_match_id}` : null;

  if (n.type === "friend_request_received") {
    body = <><strong>{actorName}</strong> quiere ser tu amigo</>;
    if (n.pending_request_id && !acted) {
      inline = (
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const r = await acceptFriendRequest(n.pending_request_id!);
              setPending(false);
              if (!r.ok) { toast.error(r.error); return; }
              setActed("accepted");
              toast.success(`Ahora son amigos`);
              router.refresh();
            }}
            className="btn-primary text-sm py-1.5 px-3"
          >
            {pending ? "…" : "Aceptar"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const r = await rejectFriendRequest(n.pending_request_id!);
              setPending(false);
              if (!r.ok) { toast.error(r.error); return; }
              setActed("rejected");
              toast.info("Solicitud rechazada");
              router.refresh();
            }}
            className="btn-ghost text-sm py-1.5 px-3 text-text-mute hover:text-danger"
          >
            Rechazar
          </button>
        </div>
      );
    } else if (acted === "accepted") {
      inline = <div className="text-primary text-xs mt-2">✓ Aceptada</div>;
    } else if (acted === "rejected") {
      inline = <div className="text-text-mute text-xs mt-2">Rechazada</div>;
    } else if (!n.pending_request_id) {
      inline = <div className="text-text-mute text-xs mt-2 italic">Ya respondida</div>;
    }
    href = actorUsername ? `/profile/${actorUsername}` : null;
  } else if (n.type === "friend_request_accepted") {
    body = <><strong>{actorName}</strong> aceptó tu solicitud</>;
    if (actorUsername) {
      inline = (
        <Link
          href={`/profile/${actorUsername}`}
          className="inline-block text-primary text-sm mt-2 hover:underline"
        >
          Ver perfil →
        </Link>
      );
    }
    href = actorUsername ? `/profile/${actorUsername}` : null;
  } else if (n.type === "attest_requested") {
    body = <>Confirma el resultado de tu partida</>;
    inline = matchHref ? (
      <Link href={matchHref} className="inline-block text-primary text-sm mt-2 hover:underline">
        Ver partida →
      </Link>
    ) : null;
    href = matchHref;
  } else if (n.type === "attest_action") {
    const action = (n.payload?.action ?? "") as string;
    if (action === "confirm") {
      body = <><strong>{actorName}</strong> firmó la partida</>;
    } else if (action === "dispute") {
      body = <><strong>{actorName}</strong> reportó un problema en la partida</>;
    } else {
      body = <><strong>{actorName}</strong> respondió a la partida</>;
    }
    href = matchHref;
  } else if (n.type === "match_confirmed") {
    body = <>Tu partida fue confirmada · rating aplicado</>;
    href = matchHref;
  } else if (n.type === "match_auto_confirmed") {
    body = <>Tu partida se auto-confirmó (7 días sin reportes)</>;
    href = matchHref;
  } else if (n.type === "match_disputed") {
    body = <>Tu partida pasó a disputa</>;
    href = matchHref;
  } else {
    body = <>Nueva notificación</>;
  }

  const isUnread = !n.read_at;
  const content = (
    <div
      className={`card flex items-start gap-3 transition-colors ${
        isUnread ? "border-primary/30 bg-primary/[.04]" : ""
      }`}
    >
      {isUnread && <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" aria-hidden />}
      {!isUnread && <span className="w-2 shrink-0" />}
      <Avatar player={n.actor as any} size={40} />
      <div className="flex-1 min-w-0">
        <div className="text-sm">{body}</div>
        <div className="text-text-mute text-xs mt-0.5">{relTime(n.created_at)}</div>
        {inline}
      </div>
    </div>
  );

  // Si la card tiene acciones inline (botones), no envolver en Link (los botones
  // se traganarían el click). Si no, envolver en Link al perfil del actor.
  if (inline && n.type === "friend_request_received" && n.pending_request_id && !acted) {
    return content;
  }
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

function EmptyState() {
  return (
    <div className="card text-center py-12">
      <div className="mb-3 flex justify-center text-text-mute select-none">
        <BellOffIcon size={56} />
      </div>
      <h2 className="text-lg font-semibold">No tienes notificaciones aún</h2>
      <p className="text-text-mute text-sm mt-1 max-w-xs mx-auto">
        Cuando alguien interactúe contigo lo verás aquí.
      </p>
    </div>
  );
}
