import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { LiveMatchScreen } from "./LiveMatchScreen";

export const dynamic = "force-dynamic";

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await supabaseServer();

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();
  if (!match) return notFound();

  // Solo el creador puede continuar la partida en vivo
  if (match.created_by !== user.id) {
    if (match.status !== "in_progress") redirect(`/matches/${id}`);
    redirect(`/matches/${id}`);
  }
  if (match.status !== "in_progress") redirect(`/matches/${id}`);
  if (match.status === "cancelled") redirect(`/dashboard`);

  const { data: mps } = await supabase
    .from("match_players")
    .select("team, user_id, profiles(id, username, display_name, avatar_url, country)")
    .eq("match_id", id)
    .order("team");

  const { data: rounds } = await supabase
    .from("match_rounds")
    .select("id, round_number, team, points, kind, created_at")
    .eq("match_id", id)
    .order("round_number", { ascending: true });

  const teamA = (mps ?? []).filter((r: any) => r.team === 1).map((r: any) => r.profiles);
  const teamB = (mps ?? []).filter((r: any) => r.team === 2).map((r: any) => r.profiles);

  return (
    <LiveMatchScreen
      matchId={id}
      modality={match.modality}
      setSize={match.set_size}
      format={match.format}
      targetPoints={match.target_points}
      capicuaBonus={match.capicua_bonus}
      startedAt={match.created_at}
      teamA={teamA as any}
      teamB={teamB as any}
      rounds={(rounds ?? []) as any}
    />
  );
}
