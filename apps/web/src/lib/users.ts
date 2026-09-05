"use server";

import { supabaseServer } from "@/lib/supabase/server";

export type SearchedUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  global_display: number | null;
  total_games: number | null;
};

/**
 * Búsqueda global por username/display_name.
 * Devuelve también rating + games (search_users RPC, migración 0013).
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

/**
 * Búsqueda restringida a amigos aceptados del usuario autenticado.
 * Si query está vacío, devuelve la lista completa de amigos (hasta `limit`).
 * Útil para selectores donde la regla es "solo amigos".
 */
export async function searchFriends(query: string, opts?: { limit?: number }): Promise<SearchedUser[]> {
  const q = (query ?? "").trim();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("search_friends", {
    q,
    lim: opts?.limit ?? 20,
  });
  if (error) {
    console.error("[searchFriends]", error);
    return [];
  }
  return (data ?? []) as SearchedUser[];
}
