/**
 * Helpers de lectura para grupos (Fase C+D #2 + #3).
 *
 * No usan "use server" — son funciones puras async invocables desde
 * Server Components o Server Actions. La autenticación y RLS del cliente
 * Supabase se encarga del filtrado de seguridad.
 */

import { supabaseServer } from "@/lib/supabase/server";

export type GroupMatchHistoryRow = {
  match_id: string;
  attribution_type: "automatic" | "retroactive" | "manual";
  attributed_at: string;
  /** ISO timestamp del match. */
  created_at: string;
  finished_at: string | null;
  target_points: number;
  modality: string | null;
  set_size: string | null;
  rated: boolean;
  /** Jugador → equipo + score (rank=1 si ganó). */
  players: Array<{
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    team: number;
    rank: number | null;
  }>;
};

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by_user_id: string;
  allow_friendlies: boolean;
  created_at: string;
  /** Rol del usuario actual en este grupo. */
  my_role: "admin" | "co_admin" | "member";
  /** Cantidad de miembros activos. */
  active_members_count: number;
};

export type GroupInvitation = {
  id: string;
  group_id: string;
  group_name: string;
  invited_by_user_id: string;
  invited_by_username: string | null;
  invited_by_display_name: string | null;
  created_at: string;
};

export type GroupMember = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "admin" | "co_admin" | "member";
  joined_at: string | null;
};

export type GroupDetails = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  allow_friendlies: boolean;
  created_by_user_id: string;
  created_at: string;
  members: GroupMember[];
  /** Rol del usuario actual; null si no es miembro. */
  my_role: "admin" | "co_admin" | "member" | null;
};

/**
 * Lista los grupos activos donde el user actual es miembro activo.
 * Ordenados por created_at desc (más nuevos primero).
 */
export async function listMyGroups(): Promise<GroupSummary[]> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, role, groups!inner(id, name, description, is_active, created_by_user_id, allow_friendlies, created_at)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!memberships) return [];

  const groups = (memberships as unknown as Array<{
    group_id: string;
    role: "admin" | "co_admin" | "member";
    groups: {
      id: string;
      name: string;
      description: string | null;
      is_active: boolean;
      created_by_user_id: string;
      allow_friendlies: boolean;
      created_at: string;
    };
  }>).filter((m) => m.groups.is_active);

  if (groups.length === 0) return [];

  // Conteo de members activos por grupo (batch).
  const groupIds = groups.map((g) => g.group_id);
  const { data: counts } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", groupIds)
    .eq("status", "active");

  const countMap = new Map<string, number>();
  for (const row of (counts ?? []) as Array<{ group_id: string }>) {
    countMap.set(row.group_id, (countMap.get(row.group_id) ?? 0) + 1);
  }

  return groups
    .map((m) => ({
      id: m.groups.id,
      name: m.groups.name,
      description: m.groups.description,
      is_active: m.groups.is_active,
      created_by_user_id: m.groups.created_by_user_id,
      allow_friendlies: m.groups.allow_friendlies,
      created_at: m.groups.created_at,
      my_role: m.role,
      active_members_count: countMap.get(m.group_id) ?? 0,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Lista las invitaciones pendientes para el user actual.
 * Incluye datos del grupo y del invitador para mostrar en UI.
 */
export async function listMyInvitations(): Promise<GroupInvitation[]> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("group_invitations")
    .select(`
      id,
      group_id,
      invited_by_user_id,
      created_at,
      groups!inner(name, is_active),
      profiles:profiles!group_invitations_invited_by_user_id_fkey(username, display_name)
    `)
    .eq("invited_user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!data) return [];

  return (data as unknown as Array<{
    id: string;
    group_id: string;
    invited_by_user_id: string;
    created_at: string;
    groups: { name: string; is_active: boolean };
    profiles: { username: string | null; display_name: string | null } | null;
  }>)
    .filter((r) => r.groups.is_active)
    .map((r) => ({
      id: r.id,
      group_id: r.group_id,
      group_name: r.groups.name,
      invited_by_user_id: r.invited_by_user_id,
      invited_by_username: r.profiles?.username ?? null,
      invited_by_display_name: r.profiles?.display_name ?? null,
      created_at: r.created_at,
    }));
}

/**
 * Detalle del grupo: settings + lista de miembros activos.
 * Devuelve null si el user no tiene acceso (RLS lo filtra).
 */
export async function getGroupDetails(groupId: string): Promise<GroupDetails | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, is_active, allow_friendlies, created_by_user_id, created_at")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) return null;
  const g = group as {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    allow_friendlies: boolean;
    created_by_user_id: string;
    created_at: string;
  };

  const { data: members } = await supabase
    .from("group_members")
    .select(`
      user_id,
      role,
      joined_at,
      profiles!inner(username, display_name, avatar_url)
    `)
    .eq("group_id", groupId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  const memberList: GroupMember[] = (members as unknown as Array<{
    user_id: string;
    role: "admin" | "co_admin" | "member";
    joined_at: string | null;
    profiles: { username: string; display_name: string | null; avatar_url: string | null };
  }> | null ?? []).map((m) => ({
    user_id: m.user_id,
    username: m.profiles.username,
    display_name: m.profiles.display_name,
    avatar_url: m.profiles.avatar_url,
    role: m.role,
    joined_at: m.joined_at,
  }));

  const myRecord = memberList.find((m) => m.user_id === user.id);

  return {
    id: g.id,
    name: g.name,
    description: g.description,
    is_active: g.is_active,
    allow_friendlies: g.allow_friendlies,
    created_by_user_id: g.created_by_user_id,
    created_at: g.created_at,
    members: memberList,
    my_role: myRecord?.role ?? null,
  };
}

/**
 * Lista los matches atribuidos a un grupo (Fase 3 #9).
 *
 * Solo devuelve matches con status='confirmed' (decisión #6: anulados no se
 * muestran en leaderboard). Ordenados por `attributed_at` desc — el match más
 * recientemente atribuido primero.
 *
 * Si `limit`/`offset` no se proveen, devuelve los primeros 25.
 *
 * RLS: el SELECT a `group_match_attributions` está limitado por la policy
 * `attributions_select_member` — solo miembros activos del grupo ven datos.
 * Si el caller no es miembro, devuelve [].
 */
export async function getGroupMatchHistory(
  groupId: string,
  opts?: { limit?: number; offset?: number },
): Promise<GroupMatchHistoryRow[]> {
  const limit = opts?.limit ?? 25;
  const offset = opts?.offset ?? 0;

  const supabase = await supabaseServer();

  const { data } = await supabase
    .from("group_match_attributions")
    .select(`
      match_id,
      attribution_type,
      attributed_at,
      matches!inner(
        id,
        created_at,
        finished_at,
        target_points,
        modality,
        set_size,
        rated,
        status
      )
    `)
    .eq("group_id", groupId)
    .eq("matches.status", "confirmed")
    .order("attributed_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const rows = (data as unknown as Array<{
    match_id: string;
    attribution_type: "automatic" | "retroactive" | "manual";
    attributed_at: string;
    matches: {
      created_at: string;
      finished_at: string | null;
      target_points: number;
      modality: string | null;
      set_size: string | null;
      rated: boolean;
    };
  }> | null) ?? [];

  if (rows.length === 0) return [];

  // Cargar players de los matches en batch para evitar N+1.
  const matchIds = rows.map((r) => r.match_id);
  const { data: playersRaw } = await supabase
    .from("match_players")
    .select(`
      match_id,
      user_id,
      team,
      rank,
      profiles!inner(username, display_name, avatar_url)
    `)
    .in("match_id", matchIds);

  const playersByMatch = new Map<string, GroupMatchHistoryRow["players"]>();
  for (const p of (playersRaw as unknown as Array<{
    match_id: string;
    user_id: string;
    team: number;
    rank: number | null;
    profiles: { username: string; display_name: string | null; avatar_url: string | null };
  }> | null) ?? []) {
    const list = playersByMatch.get(p.match_id) ?? [];
    list.push({
      user_id: p.user_id,
      username: p.profiles.username,
      display_name: p.profiles.display_name,
      avatar_url: p.profiles.avatar_url,
      team: p.team,
      rank: p.rank,
    });
    playersByMatch.set(p.match_id, list);
  }

  return rows.map((r) => ({
    match_id: r.match_id,
    attribution_type: r.attribution_type,
    attributed_at: r.attributed_at,
    created_at: r.matches.created_at,
    finished_at: r.matches.finished_at,
    target_points: r.matches.target_points,
    modality: r.matches.modality,
    set_size: r.matches.set_size,
    rated: r.matches.rated,
    players: playersByMatch.get(r.match_id) ?? [],
  }));
}
