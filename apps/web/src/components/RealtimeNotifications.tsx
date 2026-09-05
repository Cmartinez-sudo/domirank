"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Suscripción Supabase Realtime para notificaciones instantáneas.
 * Componente "invisible" (returns null) — solo establece el canal.
 *
 * Eventos escuchados:
 *   - INSERT en friend_requests donde to_user = userId  → me llegó solicitud
 *   - UPDATE en friend_requests donde from_user = userId → mi solicitud cambió
 *     de estado (aceptada/rechazada)
 *
 * En cualquier evento hace router.refresh() para que el layout re-fetch
 * el conteo y actualice los badges del nav.
 *
 * RLS-safe: Supabase Realtime respeta las policies SELECT, así que solo
 * recibimos cambios de filas que ya podemos ver.
 */
export function RealtimeNotifications({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;

    const supabase = supabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      // Nombre único por mount + router fuera de deps para evitar
      // "cannot add callbacks after subscribe()" en re-renders
      channel = supabase
        .channel(`fr:${userId}:${Math.random().toString(36).slice(2, 9)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "friend_requests", filter: `to_user=eq.${userId}` },
          () => router.refresh()
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "friend_requests", filter: `from_user=eq.${userId}` },
          () => router.refresh()
        )
        .subscribe();
    } catch (e) {
      console.error("[RealtimeNotifications] subscribe failed:", e);
    }
    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
