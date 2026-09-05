import { AppHeader } from "@/components/AppHeader";

interface SecondaryPageShellProps {
  title?: string;
  fallbackPath: string;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  /**
   * @deprecated Con el modelo up-nav actual, la flecha SIEMPRE va a
   * fallbackPath. Esta prop existía para el modelo antiguo y se mantiene
   * por compat, pero es no-op.
   */
  forceFallback?: boolean;
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
  forceFallback,
}: SecondaryPageShellProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader
        title={title}
        fallbackPath={fallbackPath}
        rightSlot={rightSlot}
        forceFallback={forceFallback}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
