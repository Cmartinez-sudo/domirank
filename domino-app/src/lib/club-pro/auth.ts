import { notFound, redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
type OrgRole = 'owner' | 'admin' | 'staff';

export type OrgMembership = {
  user: User;
  org: OrganizationRow;
  role: OrgRole;
};

const ROLES: ReadonlyArray<OrgRole> = ['owner', 'admin', 'staff'];

function isOrgRole(value: string): value is OrgRole {
  return (ROLES as ReadonlyArray<string>).includes(value);
}

/**
 * Resolves an org by slug and verifies the caller is a member.
 *
 * - Redirects to /login if no auth.
 * - 404 if org slug doesn't exist OR caller is not a member (don't leak
 *   existence of orgs to non-members).
 * - Returns { user, org, role } otherwise.
 *
 * Usage: at the top of any /admin/org/[orgSlug]/* page.
 */
export async function requireOrgMember(orgSlug: string): Promise<OrgMembership> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', orgSlug)
    .maybeSingle();

  if (orgErr || !org) notFound();

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !isOrgRole(membership.role)) notFound();

  return { user, org, role: membership.role };
}

/**
 * Same as requireOrgMember but additionally restricts to owner/admin
 * roles. Use for endpoints that mutate tournament state (create, close
 * round, etc.). Staff can read but not write.
 */
export async function requireOrgAdmin(orgSlug: string): Promise<OrgMembership> {
  const m = await requireOrgMember(orgSlug);
  if (m.role !== 'owner' && m.role !== 'admin') notFound();
  return m;
}
