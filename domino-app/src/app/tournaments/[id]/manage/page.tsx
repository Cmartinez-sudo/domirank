import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { ManagePageClient } from "./ManagePageClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function ManagePage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, status, created_by, inscription_mode, max_players, format, modality")
    .eq("id", id)
    .single();

  if (!tournament) return notFound();
  if (tournament.created_by !== user.id) redirect(`/tournaments/${id}`);
  if (!["open", "in_progress"].includes(tournament.status)) redirect(`/tournaments/${id}`);

  // Cargar jugadores
  const { data: players } = await supabase
    .from("tournament_players")
    .select("user_id, profiles(id, username, display_name, avatar_url, country)")
    .eq("tournament_id", id);

  // Cargar parejas
  const { data: pairs } = await supabase
    .from("tournament_pairs")
    .select("id, user_a_id, user_b_id, created_at")
    .eq("tournament_id", id)
    .order("created_at", { ascending: true });

  // Cargar invitaciones pendientes
  const { data: invites } = await supabase
    .from("pair_invites")
    .select("id, inviter_id, invitee_id, status, created_at, profiles!pair_invites_invitee_id_fkey(username, display_name, avatar_url)")
    .eq("tournament_id", id)
    .eq("status", "pending");

  return (
    <ManagePageClient
      tournament={tournament as any}
      players={(players ?? []).map((p: any) => p.profiles).filter(Boolean)}
      pairs={(pairs ?? []) as any[]}
      invites={(invites ?? []) as any[]}
      userId={user.id}
    />
  );
}
