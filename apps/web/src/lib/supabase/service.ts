import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con SERVICE ROLE — bypassa RLS.
 * Usar SOLO en rutas/jobs server-side internos (e.g. crons).
 * Nunca exponerlo al cliente.
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en env vars de Vercel.
 */
export function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurado en env vars");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
