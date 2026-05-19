"use server";

import { supabaseServer } from "@/lib/supabase/server";

export type SearchedUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

/**
 * Búsqueda de usuarios por username o display_name.
 * Usa la función search_users() de Postgres (con índice trigram).
 * Excluye al usuario actual por defecto.
 */
export async function searchUsers(query: string, opts?: { limit?: number; includeSelf?: boolean }): Promise<SearchedUser[]> {
  const q = (query ?? "").trim();
  if (q.length < 1) return [];

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("search_users", {
    q,
    lim: opts?.limit ?? 10,
    exclude_self: !opts?.includeSelf,
  });
  if (error) {
    console.error("[searchUsers]", error);
    return [];
  }
  return (data ?? []) as SearchedUser[];
}
