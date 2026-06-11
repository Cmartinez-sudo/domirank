import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Admin · DomiRank' };

type OrgMembershipRow = {
  role: string;
  organizations: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
};

export default async function AdminLanding() {
  const user = await requireUser();
  const supabase = await supabaseServer();

  // Orgs where the user is a member (any role).
  const { data: rawMemberships } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, slug, logo_url)')
    .eq('user_id', user.id);

  const memberships = (rawMemberships ?? []) as unknown as OrgMembershipRow[];
  const orgs = memberships
    .filter((m): m is OrgMembershipRow & { organizations: NonNullable<OrgMembershipRow['organizations']> } => m.organizations !== null)
    .map((m) => ({ ...m.organizations, role: m.role }));

  // Global admin role (separate concept from org membership).
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const isGlobalAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            href="/dashboard"
            className="text-xs uppercase tracking-wider text-slate-500 hover:text-slate-700"
          >
            ← DomiRank
          </Link>
          <span className="font-semibold">Admin</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <section>
          <h1 className="text-2xl font-bold">Tus organizaciones</h1>
          {orgs.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
              No sos miembro de ninguna organización todavía. Pediles a los
              owners que te agreguen.
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
              {orgs.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/admin/org/${org.slug}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {org.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={org.logo_url}
                          alt={org.name}
                          className="h-8 w-8 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-500">
                          {org.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium">{org.name}</div>
                        <div className="text-xs uppercase tracking-wider text-slate-500">
                          {org.role}
                        </div>
                      </div>
                    </div>
                    <span className="text-slate-300">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isGlobalAdmin && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Herramientas globales
            </h2>
            <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
              <li>
                <Link
                  href="/admin/disputes"
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium">Disputas</div>
                    <div className="text-xs text-slate-500">
                      Resolver matches reportados.
                    </div>
                  </div>
                  <span className="text-slate-300">→</span>
                </Link>
              </li>
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
