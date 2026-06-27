'use server';

import { z } from 'zod';
import { supabaseService } from '@/lib/supabase/service';
import { supabaseServer } from '@/lib/supabase/server';
import { sendClubProEmail } from './email';
import { claimSuccessEmail } from './email-templates';
import { getAppUrl } from '@/lib/email';

// ─── Lookup ──────────────────────────────────────────────────────────────────

export type InvitationLookup = {
  ok: true;
  invitation: {
    id: string;
    email: string;
    player_name: string;
    pair_id: string | null;
    claimed_at: string | null;
  };
  tournament: {
    id: string;
    name: string;
    organization_name: string;
  };
};

export type InvitationLookupResult =
  | InvitationLookup
  | { ok: false; error: 'not_found' | 'already_claimed' | 'server_error'; message: string };

/**
 * Looks up an invitation by claim_token. Uses service_role to bypass the
 * REVOKE SELECT(claim_token) policy on profiles + the RLS on
 * org_tournament_invitations.
 *
 * Called from the /claim/[token] server component before rendering the
 * form, and again inside the form submit to make sure the token didn't
 * get claimed in another tab.
 */
export async function lookupInvitation(token: string): Promise<InvitationLookupResult> {
  if (!token || token.length < 16 || token.length > 64) {
    return { ok: false, error: 'not_found', message: 'Token inválido' };
  }

  const supabase = supabaseService();

  const { data: invitation, error: invErr } = await supabase
    .from('org_tournament_invitations')
    .select('id, email, player_name, pair_id, claimed_at, tournament_id')
    .eq('claim_token', token)
    .maybeSingle();

  if (invErr) {
    return { ok: false, error: 'server_error', message: invErr.message };
  }
  if (!invitation) {
    return { ok: false, error: 'not_found', message: 'Invitación no encontrada o expirada' };
  }
  if (invitation.claimed_at) {
    return { ok: false, error: 'already_claimed', message: 'Esta invitación ya fue activada' };
  }

  const { data: tournament, error: tErr } = await supabase
    .from('org_tournaments')
    .select('id, name, organization_id, organizations(name)')
    .eq('id', invitation.tournament_id)
    .maybeSingle();

  if (tErr || !tournament) {
    return { ok: false, error: 'not_found', message: 'Torneo no encontrado' };
  }

  const orgName =
    (tournament as unknown as { organizations: { name: string } | null }).organizations?.name ?? 'Organización';

  return {
    ok: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      player_name: invitation.player_name,
      pair_id: invitation.pair_id,
      claimed_at: invitation.claimed_at,
    },
    tournament: {
      id: tournament.id,
      name: tournament.name,
      organization_name: orgName,
    },
  };
}

// ─── Claim ────────────────────────────────────────────────────────────────────

const ClaimSchema = z.object({
  token: z.string().min(16).max(64),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
});

export type ClaimResult =
  | { ok: true; tournamentId: string; orgName: string }
  | { ok: false; error: string };

/**
 * Activates a ghost account: creates the user in auth.users via the admin
 * API (service_role), associates the existing ghost profile (if any) or
 * lets the handle_new_user trigger create one, marks the invitation as
 * claimed, and links the pair player_a_user_id/player_b_user_id to the
 * new user.
 *
 * The user is created already-confirmed (email_confirm: true) so they
 * skip the email confirmation step — the token they came from IS their
 * email proof.
 *
 * After success, the caller (the page) signs the user in client-side
 * using the just-set password (Supabase JS does not expose admin
 * "create session" outside the dashboard).
 */
export async function claimInvitation(input: unknown): Promise<ClaimResult> {
  const parsed = ClaimSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }

  const lookup = await lookupInvitation(parsed.data.token);
  if (!lookup.ok) {
    return { ok: false, error: lookup.message };
  }

  const service = supabaseService();
  const email = lookup.invitation.email.toLowerCase();

  // Check if a user with this email already exists.
  const { data: existing } = await service.auth.admin.listUsers();
  const existingUser = existing.users.find((u) => u.email?.toLowerCase() === email);

  let userId: string;

  if (existingUser) {
    // User already exists (e.g. invited to a previous tournament). Set their
    // password and reuse.
    const { error: updErr } = await service.auth.admin.updateUserById(existingUser.id, {
      password: parsed.data.password,
      email_confirm: true,
    });
    if (updErr) return { ok: false, error: `update user: ${updErr.message}` };
    userId = existingUser.id;
  } else {
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        display_name: lookup.invitation.player_name,
      },
    });
    if (createErr || !created.user) {
      return { ok: false, error: `create user: ${createErr?.message ?? 'unknown'}` };
    }
    userId = created.user.id;
  }

  // Update the profile: mark NOT ghost, clear claim_token, set claimed_at,
  // set username/display_name if profile was a placeholder.
  await service
    .from('profiles')
    .update({
      is_ghost: false,
      claim_token: null,
      claimed_at: new Date().toISOString(),
      display_name: lookup.invitation.player_name,
    })
    .eq('id', userId);

  // Mark the invitation as claimed.
  await service
    .from('org_tournament_invitations')
    .update({
      claimed_at: new Date().toISOString(),
      ghost_user_id: userId,
    })
    .eq('id', lookup.invitation.id);

  // Link the pair side (A or B) to the new user.
  if (lookup.invitation.pair_id) {
    const { data: pair } = await service
      .from('org_tournament_pairs')
      .select('player_a_email, player_b_email')
      .eq('id', lookup.invitation.pair_id)
      .maybeSingle();
    if (pair) {
      const update: Record<string, string> = {};
      if (pair.player_a_email.toLowerCase() === email) update.player_a_user_id = userId;
      // player_b_email is NULL when the tournament is individual (1v1).
      if (pair.player_b_email && pair.player_b_email.toLowerCase() === email) {
        update.player_b_user_id = userId;
      }
      if (Object.keys(update).length > 0) {
        await service
          .from('org_tournament_pairs')
          .update(update)
          .eq('id', lookup.invitation.pair_id);
      }
    }
  }

  // Best-effort welcome email — never block on failure.
  const appUrl = getAppUrl();
  void sendClubProEmail({
    to: email,
    template: claimSuccessEmail({
      recipientName: lookup.invitation.player_name,
      tournamentName: lookup.tournament.name,
      orgName: lookup.tournament.organization_name,
      playerDashboardUrl: `${appUrl}/tournaments/club-pro/${lookup.tournament.id}`,
    }),
    idempotencyKey: `claim-success:${lookup.invitation.id}`,
  });

  return {
    ok: true,
    tournamentId: lookup.tournament.id,
    orgName: lookup.tournament.organization_name,
  };
}

/**
 * After claim success, the page calls this to sign the new user in using
 * the password they just set. Wraps the standard Supabase auth flow so
 * the caller doesn't import browser/server clients directly.
 */
export async function signInAfterClaim(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
