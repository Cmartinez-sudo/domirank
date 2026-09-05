import Link from "next/link";
import { NR_THRESHOLD } from "@domirank/shared/rating";

type Props = {
  totalGames: number;
};

/**
 * Card shown on the dashboard when the viewer is still NR (Not Rated).
 * Communicates the threshold, current progress, and one actionable tip.
 *
 * Hidden once isRated=true (caller is responsible — keeps this component
 * dumb so it can be unit-tested in isolation).
 */
export function NROnboardingCard({ totalGames }: Props) {
  const remaining = Math.max(0, NR_THRESHOLD - totalGames);
  const progressPct = Math.min(100, Math.round((totalGames / NR_THRESHOLD) * 100));
  const done = remaining === 0;

  return (
    <section
      className="card"
      style={{
        background: "linear-gradient(135deg, rgba(245,158,11,.08), rgba(16,185,129,.04))",
        borderColor: "rgba(245,158,11,.25)",
      }}
      aria-labelledby="nr-onboarding-title"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center font-bold text-sm">
          NR
        </div>
        <div className="flex-1 min-w-0">
          <h2 id="nr-onboarding-title" className="text-base font-semibold">
            Calibrando tu rating
          </h2>
          <p className="text-text-dim text-sm mt-1">
            {done
              ? "Tu próxima partida confirmada activa tu rating DomiRank."
              : `Te faltan ${remaining} ${remaining === 1 ? "partida confirmada" : "partidas confirmadas"} para activar tu rating.`}
          </p>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-text-mute mb-1">
              <span>Progreso</span>
              <span className="font-mono tabular-nums">
                {Math.min(totalGames, NR_THRESHOLD)} / {NR_THRESHOLD}
              </span>
            </div>
            <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={totalGames}
                aria-valuemin={0}
                aria-valuemax={NR_THRESHOLD}
                aria-label={`${totalGames} de ${NR_THRESHOLD} partidas confirmadas`}
              />
            </div>
          </div>

          <p className="text-text-mute text-xs mt-3">
            <strong className="text-text-dim">Tip:</strong> juega con oponentes distintos —
            la diversidad mejora la confiabilidad de tu rating cuando se active.
          </p>

          <div className="mt-3">
            <Link
              href="/como-funciona"
              className="text-primary text-sm hover:underline"
            >
              Cómo se calcula →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
