"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Avatar } from "@/components/Avatar";
import { BellOffIcon } from "@/components/icons";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

type NotifPreview = {
  id: string;
  type: string;
  payload: Record<string, any>;
  ref_match_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

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

function notifText(n: NotifPreview): { html: React.ReactNode; href: string } {
  const username = n.actor?.username ?? "alguien";
  const display  = n.actor?.display_name || username;
  const matchHref = (n as any).ref_match_id ? `/matches/${(n as any).ref_match_id}` : "/notifications";
  switch (n.type) {
    case "friend_request_received":
      return { html: <><strong>{display}</strong> quiere ser tu amigo</>, href: "/notifications" };
    case "friend_request_accepted":
      return { html: <><strong>{display}</strong> aceptó tu solicitud</>, href: `/profile/${username}` };
    case "attest_requested":
      return { html: <>Confirma el resultado de una partida</>, href: matchHref };
    case "attest_action": {
      const action = (n.payload as any)?.action;
      if (action === "confirm") return { html: <><strong>{display}</strong> firmó la partida</>, href: matchHref };
      if (action === "dispute") return { html: <><strong>{display}</strong> reportó la partida</>, href: matchHref };
      return { html: <><strong>{display}</strong> respondió la partida</>, href: matchHref };
    }
    case "match_confirmed":
      return { html: <>Tu partida fue confirmada</>, href: matchHref };
    case "match_auto_confirmed":
      return { html: <>Tu partida se auto-confirmó (7 días)</>, href: matchHref };
    case "match_disputed":
      return { html: <>Tu partida pasó a disputa</>, href: matchHref };
    default:
      return { html: <>Nueva notificación</>, href: "/notifications" };
  }
}

export function NotificationBell({
  userId,
  initialUnreadCount,
}: {
  userId: string;
  initialUnreadCount: number;
}) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnreadCount);
  const [open, setOpen]     = useState(false);
  const [previews, setPreviews] = useState<NotifPreview[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync con cambios server-side (e.g., otra pestaña marca como leídas)
  useEffect(() => setUnread(initialUnreadCount), [initialUnreadCount]);

  // Realtime: INSERT en notifications donde user_id = me
  // Bug evitado: nombre de canal único por mount + router fuera de deps
  // (Supabase devuelve canales existentes por nombre; reusar nombre tras
  // re-render causaría "cannot add callbacks after subscribe()")
  useEffect(() => {
    if (!userId) return;
    const supabase = supabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`bell:${userId}:${Math.random().toString(36).slice(2, 9)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => {
            setUnread((c) => c + 1);
            router.refresh();
          }
        )
        .subscribe();
    } catch (e) {
      console.error("[NotificationBell] subscribe failed:", e);
    }
    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Click fuera cierra dropdown
  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function toggle() {
    // En mobile (sin hover), un click directo navega a /notifications.
    // Pero el bell se renderiza solo en mobile header y desktop sidebar.
    // Para mobile: navegamos. Para desktop: abrimos dropdown.
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) {
      router.push("/notifications");
      return;
    }
    const next = !open;
    setOpen(next);
    if (next && previews.length === 0) {
      setLoadingPreviews(true);
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase
          .from("notifications")
          .select("id, type, payload, ref_match_id, read_at, created_at")
          .order("created_at", { ascending: false })
          .limit(10);
        const rows = (data ?? []) as any[];

        // Fetch actors in one query — soporta todos los payloads
        const actorIds = new Set<string>();
        for (const r of rows) {
          const a = r.payload?.from_user ?? r.payload?.by_user ?? r.payload?.actor_id ?? r.payload?.scorekeeper_id;
          if (a) actorIds.add(a);
        }
        const actors = new Map<string, any>();
        if (actorIds.size > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", Array.from(actorIds));
          for (const p of (profiles ?? []) as any[]) actors.set(p.id, p);
        }

        setPreviews(
          rows.map((r) => {
            const aId = r.payload?.from_user ?? r.payload?.by_user ?? r.payload?.actor_id ?? r.payload?.scorekeeper_id;
            return { ...r, actor: aId ? actors.get(aId) ?? null : null } as NotifPreview;
          })
        );
      } finally {
        setLoadingPreviews(false);
      }
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notificaciones"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative grid place-items-center w-10 h-10 rounded-full hover:bg-surface-2 transition-colors text-text-dim hover:text-text"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold leading-none border border-bg"
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Desktop dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            role="menu"
            className="hidden md:block absolute right-0 top-full mt-2 w-[360px] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-sm">Notificaciones</span>
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline"
              >
                Ver todas
              </Link>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {loadingPreviews && (
                <div className="p-6 text-center text-text-mute text-sm">Cargando…</div>
              )}
              {!loadingPreviews && previews.length === 0 && (
                <div className="p-8 text-center text-text-mute text-sm">
                  <div className="mb-2 flex justify-center opacity-60" aria-hidden>
                    <BellOffIcon size={36} />
                  </div>
                  No tienes notificaciones aún.
                </div>
              )}
              {!loadingPreviews && previews.map((n) => {
                const { html, href } = notifText(n);
                const isUnread = !n.read_at;
                return (
                  <Link
                    key={n.id}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors border-b border-border/40 ${
                      isUnread ? "bg-primary/[.03]" : ""
                    }`}
                  >
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" aria-hidden />
                    )}
                    {!isUnread && <span className="w-2 shrink-0" />}
                    <Avatar player={n.actor as any} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{html}</div>
                      <div className="text-text-mute text-xs mt-0.5">{relTime(n.created_at)}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
