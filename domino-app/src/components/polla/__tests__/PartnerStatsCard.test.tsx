/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PartnerStatsCard } from '../PartnerStatsCard';

describe('PartnerStatsCard', () => {
  it('renderiza partner y rival cuando ambos existen', () => {
    const { getByText } = render(
      <PartnerStatsCard
        bestPartnerName="Erik" bestPartnerWins={8} bestPartnerLosses={2}
        worstRivalName="Gusi" worstRivalWins={3} worstRivalLosses={7}
      />,
    );
    expect(getByText(/Erik/)).toBeTruthy();
    expect(getByText(/8W-2L/)).toBeTruthy();
    expect(getByText(/Gusi/)).toBeTruthy();
    expect(getByText(/3W-7L/)).toBeTruthy();
  });

  it('muestra "—" cuando no hay partner detectado', () => {
    const { container } = render(
      <PartnerStatsCard
        bestPartnerName={null} bestPartnerWins={0} bestPartnerLosses={0}
        worstRivalName={null} worstRivalWins={0} worstRivalLosses={0}
      />,
    );
    expect(container.textContent).toContain('—');
  });
});
