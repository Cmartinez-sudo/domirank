import { supabase } from '@/lib/supabase';

export type RelationStatus =
  | { kind: 'self' }
  | { kind: 'none' }
  | { kind: 'friends' }
  | { kind: 'outgoing_pending'; requestId: string }
  | { kind: 'incoming_pending'; requestId: string };

/**
 * Query the current relationship between the viewer and another user. Returns
 * 'self' if it's the viewer's own profile, 'friends' if a friendship row
 * exists in either direction, or one of the pending states if a
 * friend_requests row is in flight.
 */
export async function getRelationStatus(otherUserId: string): Promise<RelationStatus> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: 'none' };
  if (user.id === otherUserId) return { kind: 'self' };

  const { data: friendship } = await supabase
    .from('friendships')
    .select('user_id')
    .or(`and(user_id.eq.${user.id},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${user.id})`)
    .maybeSingle();
  if (friendship) return { kind: 'friends' };

  const { data: outgoing } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('from_user', user.id)
    .eq('to_user', otherUserId)
    .eq('status', 'pending')
    .maybeSingle();
  if (outgoing) return { kind: 'outgoing_pending', requestId: outgoing.id };

  const { data: incoming } = await supabase
    .from('friend_requests')
    .select('id')
    .eq('from_user', otherUserId)
    .eq('to_user', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (incoming) return { kind: 'incoming_pending', requestId: incoming.id };

  return { kind: 'none' };
}

export async function sendFriendRequest(toUserId: string): Promise<{ ok: boolean; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { error } = await supabase
    .from('friend_requests')
    .insert({ from_user: user.id, to_user: toUserId, status: 'pending' });
  return { ok: !error, error: error?.message ?? null };
}

export async function acceptFriendRequest(requestId: string): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.rpc('accept_friend_request', { req_id: requestId });
  return { ok: !error, error: error?.message ?? null };
}

export async function rejectFriendRequest(requestId: string): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId);
  return { ok: !error, error: error?.message ?? null };
}

export async function cancelFriendRequest(requestId: string): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from('friend_requests').delete().eq('id', requestId);
  return { ok: !error, error: error?.message ?? null };
}

export async function removeFriend(otherUserId: string): Promise<{ ok: boolean; error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(user_id.eq.${user.id},friend_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},friend_id.eq.${user.id})`);
  return { ok: !error, error: error?.message ?? null };
}
