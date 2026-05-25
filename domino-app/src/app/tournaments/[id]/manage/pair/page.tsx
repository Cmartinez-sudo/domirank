import { notFound, redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PairAssignmentClient } from "./PairAssignmentClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PairAssignmentPage({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, status, created_by, inscription_mode, max_players")
    .eq("id", id)
    .single();

  if (!tournament) return notFound();
  if (tournament.created_by !== user.id) redirect(`/tournaments/${id}`);
  if (tournament.status !== "open") redirect(`/tournaments/${id}/manage`);
  if (tournament.inscription_mode !== "individual_manual") redirect(`/tournaments/${id}/manage`);

  const { data: players } = await supabase
    .from("tournament_players")
    .select("user_id, profiles(id, username, display_name, avatar_url, country)")
    .eq("tournament_id", id);

  const { data: existingPairs } = await supabase
    .from("tournament_pairs")
    .select("id, user_a_id, user_b_id")
    .eq("tournament_id", id);

  return (
    <PairAssignmentClient
      tournament={tournament as any}
      players={(players ?? []).map((p: any) => p.profiles).filter(Boolean)}
      existingPairs={existingPairs ?? []}
    />
  );
}
