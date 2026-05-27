"use client";

type Props = {
  bestPartnerName: string | null;
  bestPartnerWins: number;
  bestPartnerLosses: number;
  worstRivalName: string | null;
  worstRivalWins: number;
  worstRivalLosses: number;
};

export function PartnerStatsCard({
  bestPartnerName, bestPartnerWins, bestPartnerLosses,
  worstRivalName, worstRivalWins, worstRivalLosses,
}: Props) {
  return (
    <div className="card space-y-3">
      <div>
        <div className="text-text-mute text-xs uppercase tracking-wide">Tu mejor partner</div>
        <div className="font-semibold mt-0.5">
          {bestPartnerName ? (
            <>{bestPartnerName} <span className="text-text-mute text-sm font-normal">({bestPartnerWins}W-{bestPartnerLosses}L)</span></>
          ) : (
            <span className="text-text-mute">—</span>
          )}
        </div>
      </div>
      <div>
        <div className="text-text-mute text-xs uppercase tracking-wide">Rival más fuerte</div>
        <div className="font-semibold mt-0.5">
          {worstRivalName ? (
            <>{worstRivalName} <span className="text-text-mute text-sm font-normal">({worstRivalWins}W-{worstRivalLosses}L)</span></>
          ) : (
            <span className="text-text-mute">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
