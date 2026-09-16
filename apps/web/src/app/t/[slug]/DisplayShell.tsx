'use client';

import Image from 'next/image';
import { computeStandings } from '@/lib/club-pro/compute-standings';
import {
  formatPairName,
  isIndividualFormat,
} from '@/lib/club-pro/pair-display';
import type { Pair, Match, PairStanding } from '@/lib/club-pro/swiss-types';
import type {
  DisplayConfig,
  DisplayZoneId,
  ElementSlot,
} from '@/lib/club-pro/display-config';
import { RoundTimer } from './RoundTimer';
import { StandingsPanel } from './StandingsPanel';
import { MatchesPanel } from './MatchesPanel';
import type { MatchCardProps } from './MatchCard';
import { OrgLogo } from './OrgLogo';
import { DisplayThemeToggle } from './DisplayThemeToggle';
import { FullscreenToggle } from './FullscreenToggle';

/**
 * Pure, side-effect-free display shell.
 *
 * Extracted from `DisplayClient` so the same rendering pipeline serves
 * two callers:
 *   1. The live public display — `DisplayClient` fetches from Supabase
 *      + subscribes to realtime, then hands the data to this shell.
 *   2. The admin's layout editor — `DisplayEditorClient` passes sample
 *      data + the working (unsaved) config so the preview updates
 *      instantly as the admin edits.
 *
 * `previewMode` toggles behaviours that would misbehave outside the
 * live display (e.g. hides the fixed FullscreenToggle since it would
 * try to fullscreen the whole editor page, and hides the ThemeToggle
 * because the editor already lives in the app's themed shell). It also
 * flags "we're inside a preview container" so `hiddenInMobile` is
 * evaluated against `previewMobile` instead of the real viewport
 * width — the preview simulates mobile without media queries.
 */

export type DisplayShellPair = {
  id: string;
  player_a_name: string;
  player_b_name: string | null;
  initial_seed: number | null;
  withdrawn_at: string | null;
};

export type DisplayShellMatch = {
  id: string;
  round_id: string;
  table_number: number;
  pair_home_id: string;
  pair_away_id: string | null;
  pair_home_score: number | null;
  pair_away_score: number | null;
  status: string;
  round_number: number;
};

export type DisplayShellRound = {
  id: string;
  round_number: number;
  started_at: string | null;
  ended_at: string | null;
};

export type DisplayShellTournament = {
  id: string;
  name: string;
  status: string;
  format: string;
  current_round_number: number | null;
  rounds_count: number;
  round_duration_minutes: number;
  target_points: number;
  organization_name: string;
  organization_logo_url: string | null;
  brand_primary_color: string | null;
};

export type DisplayShellSponsor = {
  id: string;
  position: number;
  logo_url: string;
};

export type DisplayShellProps = {
  tournament: DisplayShellTournament;
  pairs: DisplayShellPair[];
  matches: DisplayShellMatch[];
  rounds: DisplayShellRound[];
  sponsors: DisplayShellSponsor[];
  config: DisplayConfig;
  /**
   * When set, this shell is rendering inside the admin's editor
   * preview:
   *   - hides the fixed fullscreen + theme toggles
   *   - honours `previewMobile` for hide-in-mobile filtering instead
   *     of the real viewport width
   *
   * When undefined, this is the live public display: real fullscreen
   * + theme toggles rendered, and `hiddenInMobile` is not enforced
   * (the shell trusts CSS media queries to hide/show as needed — Fase
   * 2 hooks up mobile in the editor first; the real display picks up
   * the same behaviour in a follow-up).
   */
  preview?: {
    mobile: boolean;
  };
};

export function DisplayShell({
  tournament,
  pairs,
  matches,
  rounds,
  sponsors,
  config,
  preview,
}: DisplayShellProps) {
  const currentRound = rounds.find(
    (r) => r.round_number === tournament.current_round_number,
  );
  const currentRoundMatches = matches
    .filter((m) => m.round_number === tournament.current_round_number)
    .sort((a, b) => a.table_number - b.table_number);
  const isFinished = tournament.status === 'finished';
  const isMobilePreview = preview?.mobile === true;

  const enginePairs: Pair[] = pairs.map((p) => ({
    id: p.id,
    initialSeed: p.initial_seed,
    withdrawnAt: p.withdrawn_at,
  }));
  const engineMatches: Match[] = matches
    .filter((m) => m.status === 'finished' || m.status === 'bye')
    .map((m) => ({
      id: m.id,
      pairHomeId: m.pair_home_id,
      pairAwayId: m.pair_away_id,
      pairHomeScore: m.pair_home_score,
      pairAwayScore: m.pair_away_score,
      status: m.status as Match['status'],
      roundNumber: m.round_number,
    }));

  let standings: PairStanding[] = [];
  try {
    standings = computeStandings(enginePairs, engineMatches, tournament.target_points);
  } catch {
    standings = [];
  }
  const sortedStandings = [...standings].sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.effectivenessCoefficient !== b.effectivenessCoefficient) {
      return b.effectivenessCoefficient - a.effectivenessCoefficient;
    }
    if (a.pointsScored !== b.pointsScored) return b.pointsScored - a.pointsScored;
    const aVsB = a.headToHeadResults.get(b.pairId);
    if (aVsB === 'win') return -1;
    if (aVsB === 'loss') return 1;
    return a.pairId < b.pairId ? -1 : 1;
  });

  const pairById = new Map(pairs.map((p) => [p.id, p]));
  const brandColor =
    tournament.brand_primary_color && /^#[0-9a-f]{6}$/i.test(tournament.brand_primary_color)
      ? tournament.brand_primary_color
      : '#2563eb';
  const isIndividual = isIndividualFormat(tournament.format);

  const roundLabel = isFinished
    ? 'Ronda final'
    : `Mesas — Ronda ${tournament.current_round_number ?? 0}`;

  const matchCards: Array<MatchCardProps & { id: string }> = currentRoundMatches.map((m) => {
    const home = pairById.get(m.pair_home_id);
    const away = m.pair_away_id ? pairById.get(m.pair_away_id) : null;
    return {
      id: m.id,
      tableNumber: m.table_number,
      homeName: formatPairName(home),
      awayName: away ? formatPairName(away) : null,
      homeScore: m.pair_home_score,
      awayScore: m.pair_away_score,
      status: m.status as MatchCardProps['status'],
    };
  });

  const visibleSponsors =
    isMobilePreview && config.sponsors.hiddenInMobile
      ? []
      : sponsors
          .filter((s) => s.position >= 1 && s.position <= config.sponsors.slotsCount)
          .slice(0, config.sponsors.slotsCount);

  const zoneContext: ZoneContext = {
    tournament,
    currentRound: currentRound ?? null,
    isFinished,
    visibleSponsors,
    sponsorsConfig: config.sponsors,
    isMobilePreview,
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg text-text">
      {/* Header — three zones + fixed FullscreenToggle at the end. */}
      <header
        className="flex shrink-0 items-center gap-[clamp(16px,2vw,40px)] border-b px-6 py-4"
        style={{ borderBottomColor: brandColor }}
      >
        <Zone
          zoneId="header-left"
          zones={config.desktop.zones}
          ctx={zoneContext}
          className="flex shrink-0 items-center gap-[clamp(12px,1.5vw,24px)]"
        />
        <Zone
          zoneId="header-center"
          zones={config.desktop.zones}
          ctx={zoneContext}
          className="flex min-w-0 flex-1 items-center justify-center gap-4"
        />
        <Zone
          zoneId="header-right"
          zones={config.desktop.zones}
          ctx={zoneContext}
          className="flex shrink-0 items-baseline gap-[clamp(16px,2vw,40px)] text-right"
          trailing={preview ? null : <FullscreenToggle />}
        />
      </header>

      {/* Theme toggle only rendered in the live display, never in the
          preview (the editor already lives inside the app shell). */}
      {!preview && <DisplayThemeToggle />}

      <main className="grid min-h-0 flex-1 grid-cols-[60%_40%] gap-[1vw] px-[1vw] py-[1vh]">
        <StandingsPanel
          standings={sortedStandings}
          pairById={pairById}
          isIndividual={isIndividual}
        />

        <section className="flex min-h-0 flex-col gap-3">
          <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-mute">
            {roundLabel}
          </h2>
          <MatchesPanel matches={matchCards} />
        </section>
      </main>

      <footer
        className="flex shrink-0 items-center justify-between gap-6 border-t px-6 py-4 text-text-mute"
        style={{ borderTopColor: brandColor }}
      >
        <Zone
          zoneId="footer-left"
          zones={config.desktop.zones}
          ctx={zoneContext}
          className="flex shrink-0 items-center gap-6"
        />
        <Zone
          zoneId="footer-right"
          zones={config.desktop.zones}
          ctx={zoneContext}
          className="flex shrink-0 items-center gap-6"
        />
      </footer>
    </div>
  );
}

// ─── Zone renderer ─────────────────────────────────────────────

type ZoneContext = {
  tournament: DisplayShellTournament;
  currentRound: DisplayShellRound | null;
  isFinished: boolean;
  visibleSponsors: DisplayShellSponsor[];
  sponsorsConfig: DisplayConfig['sponsors'];
  isMobilePreview: boolean;
};

/**
 * Renders a display zone: iterates the ordered `ElementSlot[]` from
 * config, maps each id → concrete component, and drops in the sponsor
 * group if the sponsors config targets this zone. `trailing` slots go
 * after everything (used for the FullscreenToggle in header-right).
 */
function Zone({
  zoneId,
  zones,
  ctx,
  className,
  trailing,
}: {
  zoneId: DisplayZoneId;
  zones: DisplayConfig['desktop']['zones'];
  ctx: ZoneContext;
  className?: string;
  trailing?: React.ReactNode;
}) {
  const slots = zones[zoneId] ?? [];
  const sponsorsHere = ctx.sponsorsConfig.zone === zoneId;

  const items: Array<{ order: number; node: React.ReactNode; key: string }> = slots
    .filter((s) => s.visible)
    // Hide-in-mobile takes effect only when we're rendering a mobile preview
    // container in the editor. The live display renders normally and lets
    // CSS media queries decide layout.
    .filter((s) => !(ctx.isMobilePreview && s.hiddenInMobile))
    .map((slot, idx) => ({
      order: idx,
      key: `slot-${slot.id}`,
      node: <ElementRenderer slot={slot} ctx={ctx} />,
    }));

  if (sponsorsHere && ctx.visibleSponsors.length > 0) {
    items.push({
      order: ctx.sponsorsConfig.order,
      key: 'sponsors',
      node: <Sponsors sponsors={ctx.visibleSponsors} size={ctx.sponsorsConfig.size} />,
    });
  }

  items.sort((a, b) => a.order - b.order);

  return (
    <div className={className}>
      {items.map((it) => (
        <div key={it.key} className="contents">
          {it.node}
        </div>
      ))}
      {trailing}
    </div>
  );
}

// ─── Element renderers ────────────────────────────────────────

function ElementRenderer({ slot, ctx }: { slot: ElementSlot; ctx: ZoneContext }) {
  switch (slot.id) {
    case 'domirank-logo':
      return <DomiRankLogo size={slot.size ?? 'md'} />;
    case 'org-logo':
      return (
        <OrgLogo
          url={ctx.tournament.organization_logo_url}
          name={ctx.tournament.organization_name}
        />
      );
    case 'tournament-name':
      return <TournamentName name={ctx.tournament.name} size={slot.size ?? 'md'} />;
    case 'round':
      return (
        <RoundBlock
          current={ctx.tournament.current_round_number ?? 0}
          total={ctx.tournament.rounds_count}
        />
      );
    case 'timer':
      if (ctx.isFinished || !ctx.currentRound?.started_at) return null;
      return (
        <RoundTimer
          startedAt={ctx.currentRound.started_at}
          durationMinutes={ctx.tournament.round_duration_minutes}
        />
      );
    case 'live':
      return <LiveIndicator status={ctx.tournament.status} />;
    case 'meta':
      return (
        <div className="text-sm">
          Meta{' '}
          <span className="font-semibold text-text-dim">
            {ctx.tournament.target_points}
          </span>{' '}
          tantos
        </div>
      );
    default:
      return null;
  }
}

const DOMIRANK_LOGO_WIDTH: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-[clamp(96px,7vw,140px)]',
  md: 'w-[clamp(140px,12vw,240px)]',
  lg: 'w-[clamp(180px,16vw,320px)]',
};

function DomiRankLogo({ size }: { size: 'sm' | 'md' | 'lg' }) {
  return (
    <div className="shrink-0">
      <Image
        src="/branding/logo-horizontal-clean.svg"
        alt="DomiRank"
        width={240}
        height={60}
        priority
        className={`h-auto ${DOMIRANK_LOGO_WIDTH[size]}`}
      />
    </div>
  );
}

const NAME_TEXT: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-[clamp(18px,1.8vw,32px)]',
  md: 'text-[clamp(22px,2.4vw,44px)]',
  lg: 'text-[clamp(28px,3vw,56px)]',
};

function TournamentName({ name, size }: { name: string; size: 'sm' | 'md' | 'lg' }) {
  return (
    <h1
      className={`min-w-0 text-balance text-center font-semibold leading-tight tracking-tight text-text ${NAME_TEXT[size]}`}
    >
      {name}
    </h1>
  );
}

function RoundBlock({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-mute">
        Ronda
      </div>
      <div className="mt-0.5 font-mono text-[clamp(28px,3vw,48px)] font-semibold leading-none tabular-nums text-text">
        {current}
        <span className="text-[clamp(16px,1.5vw,24px)] font-medium text-text-mute">
          /{total}
        </span>
      </div>
    </div>
  );
}

const SPONSOR_HEIGHT: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-[clamp(48px,6vh,88px)]',
  md: 'h-[clamp(64px,9vh,128px)]',
  lg: 'h-[clamp(80px,12vh,160px)]',
};

function Sponsors({
  sponsors,
  size,
}: {
  sponsors: DisplayShellSponsor[];
  size: 'sm' | 'md' | 'lg';
}) {
  if (sponsors.length === 0) return null;
  return (
    <div className="flex items-center gap-6">
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-mute">
        Patrocinan
      </span>
      {sponsors.map((s) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={s.id}
          src={s.logo_url}
          alt={`Sponsor ${s.position}`}
          className={`w-auto object-contain ${SPONSOR_HEIGHT[size]}`}
        />
      ))}
    </div>
  );
}

/**
 * Live/finished status pill.
 */
function LiveIndicator({ status }: { status: string }) {
  if (status === 'finished') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-amber-700 ring-1 ring-inset ring-amber-500/40 dark:text-amber-300">
        Finalizado
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-700 ring-1 ring-inset ring-emerald-500/40 dark:text-emerald-300 dark:ring-emerald-500/30">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70 dark:bg-emerald-400" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        </span>
        En vivo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-text-dim ring-1 ring-inset ring-border">
      {status}
    </span>
  );
}
