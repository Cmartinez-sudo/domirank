"use client";

type ActiveMatch = {
  id: string;
  team_a_name: string;
  team_b_name: string;
  score_a: number;
  score_b: number;
};

type Props = {
  activeMatch: ActiveMatch | null;
  onStartNew: () => void;
  onContinue: (matchId: string) => void;
};

/**
 * "Big button" — el botón héroe de la polla home.
 *
 * Si hay una partida `in_progress` en esta polla → "Continuar partida en curso"
 * con score live (gradient warning→danger).
 * Si no → "Jugar nueva partida" (sombra primary).
 */
export function PollaContinueOrStartButton({ activeMatch, onStartNew, onContinue }: Props) {
  if (activeMatch) {
    return (
      <button
        type="button"
        onClick={() => onContinue(activeMatch.id)}
        className="w-full p-4 rounded-2xl flex items-center gap-3 text-left transition active:scale-[.98] bg-gradient-to-br from-warning to-danger text-white shadow-pop"
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/15 shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-base">Continuar partida en curso</div>
          <div className="text-sm opacity-90 mt-0.5 truncate">
            {activeMatch.team_a_name} {activeMatch.score_a} — {activeMatch.score_b} {activeMatch.team_b_name}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onStartNew}
      className="w-full p-4 rounded-2xl flex items-center gap-3 text-left transition active:scale-[.98] bg-surface border border-border-strong hover:bg-surface-2 shadow-[0_10px_30px_-10px_rgba(16,185,129,0.45)]"
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/15 text-primary shrink-0">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-base">Jugar nueva partida</div>
        <div className="text-sm text-text-dim mt-0.5">Elige 4 jugadores y sortea o arma las parejas</div>
      </div>
    </button>
  );
}
