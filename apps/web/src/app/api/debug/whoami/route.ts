import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Temporary diagnostic endpoint. Returns the auth.uid() that the server
 * sees and lists the user's organization memberships, going around the
 * RLS-JOIN bug that bit /admin. Will be removed once the underlying
 * issue is confirmed fixed.
 *
 * GET /api/debug/whoami
 */
export async function GET() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json(
      { authenticated: false, error: authErr?.message ?? 'no user' },
      { status: 401 },
    );
  }

  const { data: memberships, error: memErr } = await supabase
    .from('organization_members')
    .select('role, organization_id')
    .eq('user_id', user.id);

  const { data: orgsByMembership, error: orgsErr } = memberships && memberships.length > 0
    ? await supabase
        .from('organizations')
        .select('id, name, slug')
        .in('id', memberships.map((m) => m.organization_id))
    : { data: [], error: null };

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
    },
    memberships: memberships ?? [],
    membershipsError: memErr?.message ?? null,
    orgs: orgsByMembership ?? [],
    orgsError: orgsErr?.message ?? null,
  });
}
