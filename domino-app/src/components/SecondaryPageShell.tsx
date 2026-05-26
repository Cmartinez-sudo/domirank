import { AppHeader } from "@/components/AppHeader";

interface SecondaryPageShellProps {
  title?: string;
  fallbackPath: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Wrapper para páginas secundarias (no raíz del bottom nav).
 * Monta AppHeader arriba y un <main> con el contenido.
 *
 * Decisión de arquitectura: Estrategia B (shell por página, no layout group).
 * Ver TECH_DEBT.md — Sprint UX v2, decisiones de implementación.
 */
export function SecondaryPageShell({
  title,
  fallbackPath,
  rightSlot,
  children,
}: SecondaryPageShellProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader title={title} fallbackPath={fallbackPath} rightSlot={rightSlot} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
