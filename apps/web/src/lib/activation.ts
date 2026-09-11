// Sprint 1b: primera acción con valor (Combo OR = A' + E' + F).
// Idempotente: dispara SOLO la primera vez que el usuario cumple cualquiera
// de las tres rutas, y guarda profiles.first_valuable_action_at + _via.
// El evento PostHog se dispara del lado cliente (analytics es browser-only),
// así que esta lib solo maneja la persistencia server-side y devuelve el
// status para que el caller pueda emitir el evento en el momento que le sirva.

import { supabaseService } from "@/lib/supabase/service";

export type FirstValuableActionVia =
  | "match_created_with_cojugador"
  | "invite_accepted"
  | "group_with_member";

/**
 * Marca first_valuable_action si el user aún no la tenía.
 * Retorna:
 *   - `{ fired: true, via }` — se acaba de disparar por primera vez.
 *   - `{ fired: false }`     — ya estaba marcada (idempotente).
 */
export async function checkAndFireFirstValuableAction(
  userId: string,
  via: FirstValuableActionVia,
): Promise<{ fired: true; via: FirstValuableActionVia } | { fired: false }> {
  const svc = supabaseService();

  // Read + write no-atómico. Race es benigno: la 2da escritura simplemente
  // ganaría con via distinta y ambas verían fired=true. Como la métrica
  // North Star es "¿fired algún día?", eso es aceptable.
  const { data: profile } = await svc
    .from("profiles")
    .select("first_valuable_action_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return { fired: false };
  const existing = (profile as { first_valuable_action_at: string | null }).first_valuable_action_at;
  if (existing) return { fired: false };

  const { error } = await svc
    .from("profiles")
    .update({
      first_valuable_action_at: new Date().toISOString(),
      first_valuable_action_via: via,
    } as never)
    .eq("id", userId)
    .is("first_valuable_action_at", null); // condición extra por si otra ruta ganó la carrera

  if (error) {
    console.error("[checkAndFireFirstValuableAction] update failed:", error.message);
    return { fired: false };
  }

  return { fired: true, via };
}
