import Link from 'next/link';
import { requireOrgMember } from '@/lib/club-pro/auth';

export const dynamic = 'force-dynamic';

export default async function OrgAdminLayout({
  params,
  children,
}: {
  params: Promise<{ orgSlug: string }>;
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;
  // Gate the entire /admin/org/[orgSlug] subtree — non-members get 404,
  // anon users get redirected to /login.
  const { org, role } = await requireOrgMember(orgSlug);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
            >
              ← DomiRank
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              href={`/admin/org/${org.slug}`}
              className="font-semibold text-slate-900"
            >
              {org.name}
            </Link>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-600">
            {role}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
