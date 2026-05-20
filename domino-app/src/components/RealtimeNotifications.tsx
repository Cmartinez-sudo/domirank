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
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "friend_requests",
          filter: `to_user=eq.${userId}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "friend_requests",
          filter: `from_user=eq.${userId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
