import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { getRelationStatus, type RelationStatus } from '@/lib/friend-actions';

export type ProfileRatingsRow = {
  id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  is_rated: boolean | null;
  onboarded: boolean | null;
  global_display: number | null;
  global_elo: number | null;
  global_ordinal: number | null;
  total_games: number | null;
  total_wins: number | null;
  total_losses: number | null;
  total_points_won: number | null;
  total_points_lost: number | null;
  reliability_score: number | null;
  reliability_updated_at: string | null;
  rival_doubles_display: number | null;
  rival_doubles_games: number | null;
  rival_doubles_wins: number | null;
  rival_doubles_losses: number | null;
  mesa_doubles_display: number | null;
  mesa_doubles_games: number | null;
  mesa_doubles_wins: number | null;
  mesa_doubles_losses: number | null;
  d9_doubles_display: number | null;
  d9_doubles_games: number | null;
  d9_doubles_wins: number | null;
  d9_doubles_losses: number | null;
};

export function useProfileByUsername(username: string | undefined) {
  return useQuery({
    queryKey: ['profile', 'by-username', username],
    enabled: Boolean(username),
    queryFn: async (): Promise<ProfileRatingsRow | null> => {
      if (!username) return null;
      const { data, error } = await supabase
        .from('profile_ratings')
        .select('*')
        .eq('username', username)
        .single();
      if (error) throw error;
      return data as ProfileRatingsRow;
    },
    staleTime: 30_000,
  });
}

export function useRelationStatus(otherUserId: string | null | undefined) {
  return useQuery({
    queryKey: ['relation-status', otherUserId],
    enabled: Boolean(otherUserId),
    queryFn: async (): Promise<RelationStatus> => {
      if (!otherUserId) return { kind: 'none' };
      return getRelationStatus(otherUserId);
    },
    staleTime: 15_000,
  });
}
