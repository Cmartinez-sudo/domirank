import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nuevo torneo — DomiRank",
};

/**
 * Layout del wizard de creación de torneo.
 * El StepHeader sticky y el StepFooter fixed se renderizan dentro
 * de cada step-page (como client components), no acá, para que
 * tengan acceso al estado del draft vía context/localStorage.
 *
 * Este layout es mínimo para no interferir con el sticky/fixed
 * positioning de los componentes del wizard.
 */
export default function TournamentWizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
