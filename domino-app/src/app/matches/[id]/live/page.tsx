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
  if (match.status === "cancelled") redirect(`/dashboard`);
  // Para partidas de polla: permitimos status='confirmed' (trophy state inline).
  // Para quick match: solo in_progress entra al /live, lo demás va al detalle.
  const matchAnyEarly = match as Record<string, unknown>;
  const tIdEarly = matchAnyEarly.tournament_id as string | null;
  let earlyIsContinuousLeague = false;
  if (tIdEarly && match.status === "confirmed") {
    const { data: t } = await supabase.from("tournaments").select("format").eq("id", tIdEarly).maybeSingle();
    earlyIsContinuousLeague = (t as { format?: string } | null)?.format === "continuous_league";
  }
  if (match.status !== "in_progress" && !earlyIsContinuousLeague) redirect(`/matches/${id}`);

  // Determinar si el usuario es jugador de esta partida
  const { data: myMatchPlayer } = await supabase
    .from("match_players")
    .select("user_id")
    .eq("match_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const isPlayer = Boolean(myMatchPlayer);

  // Si no es jugador, verificar si es participante del torneo (modo espectador)
  let isSpectator = false;
  if (!isPlayer) {
    const tournamentId = (match as Record<string, unknown>).tournament_id as string | null;
    if (tournamentId) {
      const { data: tp } = await supabase
        .from("tournament_players")
        .select("user_id")
        .eq("tournament_id", tournamentId)
        .eq("user_id", user.id)
        .maybeSingle();
      // El organizador del torneo también puede espectarse
      const { data: tourney } = await supabase
        .from("tournaments")
        .select("created_by")
        .eq("id", tournamentId)
        .maybeSingle();
      isSpectator = Boolean(tp) || tourney?.created_by === user.id;
    }
    if (!isSpectator) redirect(`/matches/${id}`);
  }

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

  // Columnas de timer (migración 0029). Cast transitorio hasta regenerar tipos Supabase.
  // TODO: eliminar los casts una vez regenerados los tipos con `supabase gen types typescript`.
  const matchAny = match as Record<string, unknown>;

  // Fetch tournament name + format (para detectar polla mode)
  let tournamentName: string | null = null;
  let isContinuousLeague = false;
  const tournamentId = matchAny.tournament_id as string | null;
  if (tournamentId) {
    const { data: tourney } = await supabase
      .from("tournaments")
      .select("name, format")
      .eq("id", tournamentId)
      .maybeSingle();
    tournamentName = tourney?.name ?? null;
    isContinuousLeague = (tourney as { format?: string } | null)?.format === "continuous_league";
  }

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
      timeLimitMinutes={(matchAny.time_limit_minutes as number | null) ?? null}
      timerStartedAt={(matchAny.timer_started_at as string | null) ?? null}
      isSpectator={isSpectator}
      tournamentId={tournamentId}
      tournamentName={tournamentName}
      isContinuousLeague={isContinuousLeague}
      matchStatus={match.status as "in_progress" | "confirmed" | "pending_attestation"}
      isCreator={match.created_by === user.id}
    />
  );
}
