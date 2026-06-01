import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { supabaseServer } from "@/lib/supabase/server";
import { MODALIDADES } from "@/lib/modalidades";
import { getCurrentUser } from "@/lib/auth";
import { formatInfo } from "@/lib/tournament-formats";
import { SecondaryPageShell } from "@/components/SecondaryPageShell";
import { BACK_FALLBACKS } from "@/lib/back-fallbacks";
import { Bracket } from "@/components/Bracket";
import { ContinuousLeagueHomePage } from "@/components/continuous-league/ContinuousLeagueHomePage";
import type {
  ContinuousLeagueStandingsRow,
  ContinuousLeagueDailyStandingsRow,
  ContinuousLeagueMatchRow,
} from "@/types/continuous-league";
// BracketPairing + BracketProfile match the private types inside Bracket.tsx
type BracketPairing = {
  id: number;
  round: number;
  board: number;
  team_a_user_ids: string[];
  team_b_user_ids: string[];
  match_id: string | null;
  winner_side: "a" | "b" | null;
};
type BracketProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};
import { GenerateNextRoundButton, GeneratePairingsButton } from "./TournamentActions";
import { PageTransition } from "@/components/Motion";
import { TournamentLeaderboard } from "./TournamentLeaderboard";
import { HeroNextMatch, HeroWaiting } from "@/components/tournament/HeroNextMatch";
import { TournamentRealtimeRefresher } from "./TournamentRealtimeRefresher";
import type { LeaderboardRow } from "@/types/leaderboard";

export const dynamic = "force-dynamic";

export default async function TournamentDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string; day?: string }>;
}) {
  const user = await getCurrentUser();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServer();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();
  if (!tournament) return notFound();

  // ─── Polla format: branch to ContinuousLeagueHomePage ─────────────────
  if ((tournament as { format?: string }).format === "continuous_league") {
    const currentSeason = (tournament as { current_season?: number }).current_season ?? 1;
    // Validar ?season — solo aceptamos enteros entre 1 y current_season
    const requestedSeason = sp.season ? parseInt(sp.season, 10) : NaN;
    const viewingSeason = Number.isInteger(requestedSeason) && requestedSeason >= 1 && requestedSeason <= currentSeason
      ? requestedSeason
      : currentSeason;

    // Day filter: solo válido en polla continua (is_open_ended).
    // sp.day puede ser "today", una fecha YYYY-MM-DD, o nada.
    const isOpenEnded  = (tournament as { is_open_ended?: boolean }).is_open_ended ?? false;
    const rawDay       = typeof sp.day === "string" ? sp.day : null;
    // Regex YYYY-MM-DD — solo permitimos formato exacto
    const isValidDate  = rawDay != null && /^\d{4}-\d{2}-\d{2}$/.test(rawDay) && !Number.isNaN(Date.parse(rawDay));
    const dayFilter    = isOpenEnded && (rawDay === "today" || isValidDate) ? "today" : "all";

    // Calcular session_day "hoy" en server.
    // Caracas = UTC-4 (no DST), cutoff a 5am Caracas = 9am UTC.
    // Estrategia: tomar "now" en hora Caracas y restar 5 horas. Lo que quede
    // como fecha (YYYY-MM-DD en Caracas) es el session_day actual.
    //   nowCaracas = nowUTC - 4h  (Caracas está atrás de UTC)
    //   sessionStart = nowCaracas - 5h
    //   session_day = fecha (YYYY-MM-DD) de sessionStart
    // Combinando: session_day = fecha de (nowUTC - 9h) en UTC.
    const sessionStartUtc = new Date(Date.now() - 9 * 60 * 60 * 1000);
    const todaySessionDay = sessionStartUtc.toISOString().slice(0, 10);

    // selectedDay para el DateSelector. Se determina así:
    //  - ?day=today o ausente o inválido → selectedDay = todaySessionDay
    //  - ?day=YYYY-MM-DD válido          → selectedDay = ese día
    const selectedDay: string = isValidDate ? (rawDay as string) : todaySessionDay;
    // p_session_day para el RPC: null cuando es hoy (default del RPC), o la fecha.
    const rpcSessionDay: string | null = isValidDate ? (rawDay as string) : null;

    // Fetch Global standings via el RPC clásico (rich shape: PF/PC/diff/partner).
    // El leaderboard "Hoy" usa el nuevo RPC (mig 0051) que cuenta con cutoff 5am
    // session_day en lugar de medianoche. SIEMPRE pedimos ambos cuando es continua
    // — así el switch entre tabs no re-fetcha el dataset opuesto.
    const { data: standings } = await supabase
      .rpc("continuous_league_standings", {
        p_tournament_id: tournament.id,
        p_season:        viewingSeason === currentSeason ? null : viewingSeason,
        p_day_filter:    null,
      });

    // Fetch Daily standings — solo cuando es polla continua (is_open_ended).
    // En polla cerrada o histórica no aplica concepto de "hoy".
    let dailyStandings: ContinuousLeagueDailyStandingsRow[] = [];
    let availableSessionDays: string[] = [];
    if (isOpenEnded && viewingSeason === currentSeason) {
      const { data: daily } = await supabase
        .rpc("continuous_league_daily_standings", {
          p_tournament_id: tournament.id,
          p_session_day:   rpcSessionDay, // null = hoy, o 'YYYY-MM-DD'
        });
      dailyStandings = (daily ?? []) as ContinuousLeagueDailyStandingsRow[];

      // session_days con partidas confirmadas para el DateSelector (DESC).
      // Reusamos continuous_league_winners_history que ya devuelve 1 fila por
      // session_day. p_limit=100 = ~3 meses, suficiente para el MVP.
      const { data: sessionDaysRaw } = await supabase.rpc(
        "continuous_league_winners_history",
        { p_tournament_id: tournament.id, p_limit: 100 },
      );
      availableSessionDays = ((sessionDaysRaw ?? []) as Array<{ session_day: string }>)
        .map((r) => r.session_day);
    }

    // Fetch pairings + matches con rondas para armar la matches list.
    // Para vista actual usamos la view (filtra por current_season); para
    // histórico, query directa con filtro de season.
    const pairingsQuery = viewingSeason === currentSeason
      ? await supabase
          .from("continuous_league_current_season_pairings")
          .select("id, team_a_user_ids, team_b_user_ids, match_id, matches(id, status, created_at, target_points, match_rounds(team, points))")
          .eq("tournament_id", tournament.id)
      : await supabase
          .from("tournament_pairings")
          .select("id, team_a_user_ids, team_b_user_ids, match_id, matches(id, status, created_at, target_points, match_rounds(team, points))")
          .eq("tournament_id", tournament.id)
          .eq("season", viewingSeason);

    const { data: pairings } = pairingsQuery;

    // Fetch user names para la matches list + name resolution
    const { data: players } = await supabase
      .from("tournament_players")
      .select("user_id, profiles(username, display_name)")
      .eq("tournament_id", tournament.id);

    const userNames: Record<string, string> = {};
    for (const p of players ?? []) {
      const prof = p.profiles as unknown as { username: string; display_name: string | null } | null;
      const fullName = prof?.display_name ?? prof?.username ?? "?";
      // Solo primer nombre — el MVP usa "Carlos & Erik" no "Carlos Martínez & Erik Pérez"
      userNames[p.user_id] = fullName.split(" ")[0];
    }

    const playerCount = (players ?? []).length;

    type RawMatch = {
      id:            string;
      status:        string;
      created_at:    string;
      target_points: number;
      match_rounds:  Array<{ team: number; points: number }>;
    };
    type RawPairing = {
      id:              string;
      team_a_user_ids: string[];
      team_b_user_ids: string[];
      match_id:        string | null;
      // Supabase typed-joins devuelven array para foreign-key joins. La
      // FK match_id es 1:1 lógicamente, así que tomamos [0] o null.
      matches:         RawMatch | RawMatch[] | null;
    };

    // Map a ContinuousLeagueMatchRow + detect activeMatch
    const matchRows: ContinuousLeagueMatchRow[] = [];
    for (const p of (pairings ?? []) as unknown as RawPairing[]) {
      const m: RawMatch | null = Array.isArray(p.matches) ? p.matches[0] ?? null : p.matches;
      if (!m) continue;
      // Solo incluir matches con status visible (no cancelled/voided)
      if (m.status !== "in_progress" && m.status !== "completed"
          && m.status !== "confirmed" && m.status !== "pending_attestation") continue;
      const scoreA = m.match_rounds.filter((r) => r.team === 1).reduce((s, r) => s + r.points, 0);
      const scoreB = m.match_rounds.filter((r) => r.team === 2).reduce((s, r) => s + r.points, 0);
      let winner: 1 | 2 | null = null;
      if (m.status !== "in_progress") {
        if (scoreA > scoreB) winner = 1;
        else if (scoreB > scoreA) winner = 2;
      }
      matchRows.push({
        match_id:        m.id,
        status:          m.status as ContinuousLeagueMatchRow["status"],
        team_a_user_ids: p.team_a_user_ids,
        team_b_user_ids: p.team_b_user_ids,
        score_a:         scoreA,
        score_b:         scoreB,
        winner_team:     winner,
        created_at:      m.created_at,
      });
    }

    const activeMatch = matchRows.find((m) => m.status === "in_progress") ?? null;

    // Tab counts: cuántas partidas finalizadas hoy vs total
    const startOfTodayCaracas = (() => {
      const d = new Date();
      // Caracas = UTC-4 (no DST). Server `now()` es UTC.
      const utcMidnight = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 4, 0, 0));
      return utcMidnight;
    })();
    const finishedMatches = matchRows.filter((m) => m.status !== "in_progress");
    const allCount   = finishedMatches.length;
    const todayCount = finishedMatches.filter((m) => new Date(m.created_at) >= startOfTodayCaracas).length;

    return (
      <ContinuousLeagueHomePage
        tournament={{
          id:             tournament.id,
          name:           (tournament as { name: string }).name,
          is_open_ended:  isOpenEnded,
          current_season: currentSeason,
          created_by:     (tournament as { created_by: string }).created_by,
          status:         (tournament as { status: string }).status as "open" | "in_progress" | "finished" | "cancelled",
          total_rounds:   (tournament as { total_rounds?: number | null }).total_rounds ?? null,
          created_at:     (tournament as { created_at: string }).created_at,
        }}
        currentUserId={user!.id}
        standings={(standings ?? []) as ContinuousLeagueStandingsRow[]}
        dailyStandings={dailyStandings}
        rosterUserIds={(players ?? []).map((p) => p.user_id)}
        matches={matchRows}
        activeMatch={activeMatch}
        playerCount={playerCount}
        userNames={userNames}
        viewingSeason={viewingSeason}
        dayFilter={dayFilter}
        todayCount={todayCount}
        allCount={allCount}
        selectedDay={selectedDay}
        todaySessionDay={todaySessionDay}
        availableDays={availableSessionDays}
      />
    );
  }

  // ─── Standings ─────────────────────────────────────────────
  const { data: standingsRaw } = await supabase
    .rpc("get_tournament_standings", { p_tournament_id: id });

  const standings: LeaderboardRow[] = (standingsRaw ?? []).map((r: LeaderboardRow) => ({
    ...r,
    rank:        Number(r.rank),
    wins:        Number(r.wins),
    losses:      Number(r.losses),
    win_pct:     Number(r.win_pct),
    pf:          Number(r.pf),
    pc:          Number(r.pc),
    plus_minus:  Number(r.plus_minus),
  }));

  // ─── Matches ───────────────────────────────────────────────
  const { data: matches } = await supabase
    .from("matches")
    .select("id, set_size, format, created_at, status, match_players(team, score, user_id, rank, profiles(username, display_name, avatar_url, country))")
    .eq("tournament_id", id)
    .order("created_at", { ascending: false })
    .limit(30);

  // ─── Pairings ──────────────────────────────────────────────
  const { data: pairings } = await supabase
    .from("tournament_pairings")
    .select("*")
    .eq("tournament_id", id)
    .order("round", { ascending: true })
    .order("board", { ascending: true });

  // ─── Players + profiles ────────────────────────────────────
  const { data: tPlayers } = await supabase
    .from("tournament_players")
    .select("user_id, profiles(id, username, display_name, avatar_url)")
    .eq("tournament_id", id);

  const profiles = (tPlayers ?? []).map((tp: { profiles: unknown }) => tp.profiles).filter(Boolean) as {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }[];

  // ─── Hero: pairing activo del usuario en la ronda actual ───
  let userPairing: {
    id: string;
    round: number;
    board: number;
    team_a_user_ids: string[];
    team_b_user_ids: string[];
    match_id: string | null;
    match: { id: string; status: string } | null;
  } | null = null;

  if (user && tournament.status === "in_progress") {
    const userId = user.id;
    // Buscar la ronda más reciente en la que el usuario participa y el match
    // no está aún confirmado
    const { data: activePairings } = await supabase
      .from("tournament_pairings")
      .select("id, round, board, team_a_user_ids, team_b_user_ids, match_id, match:matches(id, status)")
      .eq("tournament_id", id)
      .or(`team_a_user_ids.cs.{${userId}},team_b_user_ids.cs.{${userId}}`)
      .order("round", { ascending: false })
      .limit(5);

    // Priorizar el pairing sin match confirmado
    // Supabase typed join: match puede venir como array (1:many) o null
    type RawPairing = {
      id: string;
      round: number;
      board: number;
      team_a_user_ids: string[];
      team_b_user_ids: string[];
      match_id: string | null;
      match: { id: string; status: string }[] | null;
    };
    const pending = (activePairings as RawPairing[] | null ?? []).find((p) => {
      if (!p.match_id) return true;
      const matchStatus = Array.isArray(p.match) ? p.match[0]?.status : null;
      return matchStatus === "in_progress" || matchStatus === "pending_attestation";
    });

    if (pending) {
      // match siempre es array en el tipo Supabase generado para joined tables
      const matchObj = Array.isArray(pending.match) ? pending.match[0] ?? null : null;
      userPairing = {
        id: pending.id,
        round: pending.round,
        board: pending.board ?? 1,
        team_a_user_ids: pending.team_a_user_ids,
        team_b_user_ids: pending.team_b_user_ids,
        match_id: pending.match_id,
        match: matchObj ?? null,
      };
    }
  }

  // ─── Hero open: inscribed count ────────────────────────────
  const inscribedCount = tPlayers?.length ?? 0;
  const maxPlayers = (tournament as { max_players?: number }).max_players ?? 0;
  const numBoards = (tournament as { num_boards?: number }).num_boards ?? 1;

  // Para allPairsReady: cada jugador tiene su par en tournament_pairs
  const { data: pairsData } = await supabase
    .from("tournament_pairs")
    .select("id")
    .eq("tournament_id", id);
  const pairsCount = pairsData?.length ?? 0;
  const allPairsReady = inscribedCount > 0 && pairsCount >= Math.floor(inscribedCount / 2);

  // ─── Derived flags ─────────────────────────────────────────
  const m = MODALIDADES[(tournament as { modality?: string }).modality as keyof typeof MODALIDADES] ?? MODALIDADES.custom;
  const fmtInfo = formatInfo((tournament as { format?: string }).format);
  const isOwner = user?.id === (tournament as { created_by?: string }).created_by;
  const hasPairings = (pairings ?? []).length > 0;
  const isBracketFormat = ["single_elim", "double_elim"].includes((tournament as { format?: string }).format ?? "");
  const isRoundFormat = ["round_robin", "swiss"].includes((tournament as { format?: string }).format ?? "");
  const tournamentStatus = (tournament as { status: string }).status;
  const timeLimitMinutes = (tournament as { time_limit_minutes?: number | null }).time_limit_minutes ?? null;
  const totalRounds = (tournament as { total_rounds?: number | null }).total_rounds ?? null;
  const currentRound = (tournament as { current_round?: number | null }).current_round ?? null;

  const tournamentName = (tournament as { name: string }).name;

  return (
    <SecondaryPageShell title={tournamentName} fallbackPath={BACK_FALLBACKS.tournament_detail}>
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4">
        {/* ── Realtime refresher (Client) ── */}
        <TournamentRealtimeRefresher tournamentId={id} />

        {/* ── Sticky header ── */}
        <section className="card !p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <VisibilityBadge v={(tournament as { visibility?: string }).visibility ?? "private"} />
                <StatusBadge status={tournamentStatus} />
              </div>
              <h1 className="text-xl font-bold truncate">{(tournament as { name: string }).name}</h1>
              <p className="text-text-mute text-sm mt-0.5">
                {fmtInfo.name} · {m.name} · {(tournament as { points_to_win?: number }).points_to_win ?? "?"} pts
                {timeLimitMinutes ? ` · ${timeLimitMinutes} min/partida` : ""}
              </p>
              {currentRound != null && totalRounds != null && tournamentStatus === "in_progress" && (
                <p className="text-text-mute text-xs mt-0.5">
                  Ronda {currentRound} de {totalRounds} · {inscribedCount} jugadores
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Hero: Tu próxima partida ── */}
        {tournamentStatus === "in_progress" && userPairing && (
          <HeroNextMatch
            pairing={userPairing}
            profiles={profiles}
            tournamentId={id}
            timeLimitMinutes={timeLimitMinutes}
            numBoards={numBoards}
          />
        )}

        {/* ── Hero: Esperando iniciar ── */}
        {tournamentStatus === "open" && (
          <HeroWaiting
            inscribedCount={inscribedCount}
            maxPlayers={maxPlayers}
            isOrganizer={isOwner}
            tournamentId={id}
            allPairsReady={allPairsReady}
          />
        )}

        {/* ── Bracket (elim formats) ── */}
        {isBracketFormat && (
          <section className="card p-0 overflow-hidden">
            <h2 className="px-4 py-3 border-b border-border font-semibold">Bracket</h2>
            <div className="p-4">
              <Bracket
                pairings={(pairings ?? []) as unknown as BracketPairing[]}
                profiles={profiles as unknown as BracketProfile[]}
                tournamentId={id}
                isOwner={isOwner}
              />
            </div>
          </section>
        )}

        {/* ── Rounds (round_robin / swiss) ── */}
        {isRoundFormat && hasPairings && (
          <RoundsView
            pairings={pairings ?? []}
            profiles={profiles}
            tournamentId={id}
            isOwner={isOwner}
            userId={user?.id ?? null}
            numBoards={numBoards}
          />
        )}

        {/* ── Standings — Leaderboard v2 ── */}
        <TournamentLeaderboard
          tournamentId={id}
          initialStandings={standings}
          viewerId={user?.id ?? null}
          isOrganizer={isOwner}
        />

        {/* ── Ultimas partidas ── */}
        {matches && matches.length > 0 && (
          <RecentMatchesSection matches={matches as unknown as RecentMatch[]} />
        )}

        {/* ── Acciones del organizador ── */}
        {isOwner && (
          <OrganizerActions
            tournamentId={id}
            status={tournamentStatus}
            format={(tournament as { format?: string }).format ?? ""}
            hasPairings={hasPairings}
            isRoundFormat={isRoundFormat}
            isBracketFormat={isBracketFormat}
          />
        )}
      </div>
    </PageTransition>
    </SecondaryPageShell>
  );
}

// ─── RoundsView ───────────────────────────────────────────────

function RoundsView({
  pairings,
  profiles,
  tournamentId,
  isOwner,
  userId,
  numBoards,
}: {
  pairings: Record<string, unknown>[];
  profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null }[];
  tournamentId: string;
  isOwner: boolean;
  userId: string | null;
  numBoards?: number;
}) {
  const rounds = Array.from(new Set(pairings.map((p) => p.round as number))).sort((a, b) => a - b);
  const showBoards = (numBoards ?? 1) > 1;
  return (
    <div className="space-y-3">
      {rounds.map((round) => {
        const rPairings = pairings.filter((p) => (p.round as number) === round);
        return (
          <section key={round} className="card p-0 overflow-hidden">
            <h2 className="px-4 py-2.5 border-b border-border font-semibold text-sm">
              Ronda {round}
            </h2>
            <div className="divide-y divide-border">
              {rPairings.map((p) => {
                const teamAIds = (p.team_a_user_ids as string[]) ?? [];
                const teamBIds = (p.team_b_user_ids as string[]) ?? [];
                const teamA = teamAIds.map((uid) => profiles.find((pr) => pr.id === uid)).filter(Boolean) as typeof profiles;
                const teamB = teamBIds.map((uid) => profiles.find((pr) => pr.id === uid)).filter(Boolean) as typeof profiles;

                const isUserPairing = userId && (teamAIds.includes(userId) || teamBIds.includes(userId));
                const matchId = p.match_id as string | null;
                const boardNum = p.board as number ?? 1;

                return (
                  <div
                    key={p.id as string}
                    className={`flex items-center gap-3 px-4 py-3 ${isUserPairing ? "bg-primary/[.04] border-l-2 border-l-primary" : ""}`}
                  >
                    {/* Mesa badge — solo si el torneo tiene más de 1 mesa */}
                    {showBoards && (
                      <span className="text-xs font-semibold text-text-mute shrink-0 w-12 text-center">
                        M{boardNum}
                      </span>
                    )}
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <div className="flex -space-x-1.5">
                        {teamA.map((pl) => (
                          <Avatar key={pl.id} player={pl} size={24} />
                        ))}
                      </div>
                      <span className="text-sm text-text-dim truncate">
                        {teamA.map((pl) => pl.display_name ?? pl.username).join(" & ")}
                      </span>
                    </div>
                    <span className="text-text-mute text-sm font-medium shrink-0">vs</span>
                    <div className="flex-1 flex items-center gap-2 min-w-0 justify-end">
                      <span className="text-sm text-text-dim truncate text-right">
                        {teamB.map((pl) => pl.display_name ?? pl.username).join(" & ")}
                      </span>
                      <div className="flex -space-x-1.5">
                        {teamB.map((pl) => (
                          <Avatar key={pl.id} player={pl} size={24} />
                        ))}
                      </div>
                    </div>
                    {matchId ? (
                      <Link href={`/matches/${matchId}`} className="text-xs text-primary hover:underline shrink-0">
                        Ver
                      </Link>
                    ) : isUserPairing ? (
                      <Link
                        href={`/matches/new?tournament=${tournamentId}&pairing=${p.id as string}`}
                        className="text-xs btn-primary py-1 px-2 shrink-0"
                      >
                        Jugar
                      </Link>
                    ) : isOwner ? (
                      <Link
                        href={`/matches/new?tournament=${tournamentId}&pairing=${p.id as string}`}
                        className="text-xs text-text-mute hover:text-primary shrink-0"
                      >
                        Jugar
                      </Link>
                    ) : (
                      <span className="text-xs text-text-mute shrink-0">Pendiente</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Recent matches section ───────────────────────────────────

type RecentMatch = {
  id: string;
  created_at: string;
  status: string;
  match_players: {
    team: number;
    score: number;
    user_id: string;
    rank: number | null;
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  }[];
};

function RecentMatchesSection({ matches }: { matches: RecentMatch[] }) {
  return (
    <section className="card p-0 overflow-hidden">
      <h2 className="px-4 py-3 border-b border-border font-semibold">
        Partidas ({matches.length})
      </h2>
      <div>
        {matches.map((mm) => {
          const teams: Record<number, typeof mm.match_players> = {};
          for (const mp of mm.match_players ?? []) {
            (teams[mp.team] ??= []).push(mp);
          }
          const teamArr = Object.entries(teams).sort(([a], [b]) => +a - +b);
          const winner =
            mm.status === "completed" || mm.status === "confirmed"
              ? teamArr.find(([, ps]) => ps[0]?.rank === 1)
              : null;

          return (
            <Link
              key={mm.id}
              href={mm.status === "in_progress" ? `/matches/${mm.id}/live` : `/matches/${mm.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border/30 hover:bg-surface-2/60 first:border-t-0"
            >
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {teamArr.map(([t, ps], i) => (
                  <span key={t} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-text-mute mx-1">vs</span>}
                    {ps.map((p) => (
                      <Avatar key={p.user_id} player={p.profiles as { username: string; display_name: string | null; avatar_url: string | null }} size={22} />
                    ))}
                    <span
                      className={`font-mono font-semibold ${
                        winner && winner[0] === t ? "text-primary" : ""
                      }`}
                    >
                      {ps[0]?.score ?? 0}
                    </span>
                  </span>
                ))}
              </div>
              <div className="text-text-mute text-xs shrink-0">
                {mm.status === "in_progress" && (
                  <span className="badge bg-warning/15 text-warning mr-2">en curso</span>
                )}
                {new Date(mm.created_at).toLocaleDateString("es", {
                  day: "2-digit",
                  month: "short",
                })}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── Organizer actions panel ──────────────────────────────────

function OrganizerActions({
  tournamentId,
  status,
  format,
  hasPairings,
  isRoundFormat,
  isBracketFormat,
}: {
  tournamentId: string;
  status: string;
  format: string;
  hasPairings: boolean;
  isRoundFormat: boolean;
  isBracketFormat: boolean;
}) {
  if (status === "finished" || status === "archived") return null;

  return (
    <section className="card !p-4">
      <h2 className="font-semibold text-sm text-text-mute uppercase tracking-wide mb-3">
        Acciones del organizador
      </h2>
      <div className="flex flex-wrap gap-2">
        {status === "open" && (
          <Link href={`/tournaments/${tournamentId}/manage`} className="btn-primary text-sm">
            Gestionar torneo
          </Link>
        )}
        {status === "in_progress" && (
          <Link href={`/tournaments/${tournamentId}/manage`} className="btn-ghost text-sm">
            Gestionar inscritos
          </Link>
        )}
        {status === "in_progress" && !hasPairings && (
          <GeneratePairingsButton tournamentId={tournamentId} />
        )}
        {status === "in_progress" && hasPairings && isRoundFormat && format === "swiss" && (
          <GenerateNextRoundButton tournamentId={tournamentId} />
        )}
        {status === "in_progress" && (isRoundFormat || isBracketFormat) && (
          <Link
            href={`/matches/new?tournament=${tournamentId}`}
            className="btn-ghost text-sm"
          >
            + Registrar partida
          </Link>
        )}
        {status === "in_progress" && format === "rotation" && (
          <Link href={`/matches/new?tournament=${tournamentId}`} className="btn-primary text-sm">
            + Jugar partida
          </Link>
        )}
      </div>
    </section>
  );
}

// ─── Small badge helpers ──────────────────────────────────────

function VisibilityBadge({ v }: { v: string }) {
  if (v === "public") {
    return (
      <span className="badge bg-info/15 text-info text-xs">Pública</span>
    );
  }
  if (v === "code") {
    return (
      <span className="badge bg-warning/15 text-warning text-xs">Por código</span>
    );
  }
  return <span className="badge bg-surface-2 text-text-mute text-xs">Privada</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:       { label: "Borrador",    cls: "bg-surface-2 text-text-mute" },
    open:        { label: "Abierto",     cls: "bg-info/15 text-info" },
    in_progress: { label: "En curso",    cls: "bg-primary/15 text-primary" },
    finished:    { label: "Finalizado",  cls: "bg-surface-2 text-text-mute" },
    archived:    { label: "Archivado",   cls: "bg-surface-2 text-text-mute" },
    cancelled:   { label: "Cancelado",   cls: "bg-danger/15 text-danger" },
  };
  const s = map[status] ?? { label: status, cls: "bg-surface-2 text-text-mute" };
  return <span className={`badge text-xs ${s.cls}`}>{s.label}</span>;
}
