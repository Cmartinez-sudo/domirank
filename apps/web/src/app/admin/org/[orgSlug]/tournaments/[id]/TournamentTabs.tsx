'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { slug: 'overview', label: 'Resumen' },
  { slug: 'pairs', label: 'Parejas' },
  { slug: 'rounds', label: 'Rondas' },
  { slug: 'standings', label: 'Clasificación' },
  { slug: 'settings', label: 'Configuración' },
] as const;

export function TournamentTabs({
  orgSlug,
  tournamentId,
}: {
  orgSlug: string;
  tournamentId: string;
}) {
  const pathname = usePathname();
  const basePath = `/admin/org/${orgSlug}/tournaments/${tournamentId}`;

  return (
    <nav className="-mb-px flex gap-6 border-b border-slate-200" aria-label="Tabs">
      {TABS.map((t) => {
        const href = `${basePath}/${t.slug}`;
        const active = pathname === href || (t.slug === 'overview' && pathname === basePath);
        return (
          <Link
            key={t.slug}
            href={href}
            className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
