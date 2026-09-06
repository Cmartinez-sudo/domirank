import { Text, View } from 'react-native';

import { Avatar, Badge } from '@/components/ui';
import type { ProfileRatingsRow } from '@/hooks/useProfile';

type Props = {
  profile: ProfileRatingsRow;
  actionSlot?: React.ReactNode;
};

// Rough tier boundaries mirrored from the PWA. Kept inline for MVP; move to
// @domirank/shared/rating if we need them elsewhere.
function tierLabel(display: number): string {
  if (display >= 8) return 'Élite';
  if (display >= 6) return 'Avanzado';
  if (display >= 4) return 'Intermedio';
  if (display >= 2) return 'Principiante';
  return 'Nuevo';
}

export function ProfileHero({ profile, actionSlot }: Props) {
  const display = profile.display_name ?? profile.username ?? 'Sin nombre';
  const rating = Number.isFinite(profile.global_display) ? Number(profile.global_display) : null;
  const isRated = profile.is_rated === true;

  return (
    <View className="items-center py-6">
      <Avatar url={profile.avatar_url} name={display} size={96} />
      <Text className="text-2xl font-bold text-text dark:text-text-inverse mt-4">{display}</Text>
      {profile.username ? (
        <Text className="text-text-mute dark:text-text-dim-dark mt-1">@{profile.username}</Text>
      ) : null}
      {profile.country ? (
        <Text className="text-text-mute dark:text-text-dim-dark mt-1">{profile.country}</Text>
      ) : null}

      {rating != null ? (
        <View className="items-center mt-6">
          <Text className="text-6xl font-black text-primary">{rating.toFixed(1)}</Text>
          <View className="mt-2">
            {isRated ? (
              <Badge label={tierLabel(rating)} variant="success" />
            ) : (
              <Badge label="Sin rating" variant="default" />
            )}
          </View>
        </View>
      ) : null}

      {actionSlot ? <View className="mt-6 w-full px-6">{actionSlot}</View> : null}
    </View>
  );
}
