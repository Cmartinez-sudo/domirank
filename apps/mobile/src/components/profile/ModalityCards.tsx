import { Text, View } from 'react-native';

import { Card } from '@/components/ui';
import type { ProfileRatingsRow } from '@/hooks/useProfile';

type Modality = {
  label: string;
  display: number | null;
  games: number;
  wins: number;
  losses: number;
};

export function ModalityCards({ profile }: { profile: ProfileRatingsRow }) {
  const modalities: Modality[] = [
    {
      label: 'Rival (mano a mano)',
      display: profile.rival_doubles_display,
      games: profile.rival_doubles_games ?? 0,
      wins: profile.rival_doubles_wins ?? 0,
      losses: profile.rival_doubles_losses ?? 0,
    },
    {
      label: 'Mesa (parejas)',
      display: profile.mesa_doubles_display,
      games: profile.mesa_doubles_games ?? 0,
      wins: profile.mesa_doubles_wins ?? 0,
      losses: profile.mesa_doubles_losses ?? 0,
    },
    {
      label: 'D9 (legacy)',
      display: profile.d9_doubles_display,
      games: profile.d9_doubles_games ?? 0,
      wins: profile.d9_doubles_wins ?? 0,
      losses: profile.d9_doubles_losses ?? 0,
    },
  ];

  const visible = modalities.filter((m) => m.games > 0);
  if (visible.length === 0) {
    return null;
  }

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold text-text dark:text-text-inverse">Por modalidad</Text>
      {visible.map((m) => (
        <Card key={m.label} padding="md">
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-base font-semibold text-text dark:text-text-inverse">{m.label}</Text>
              <Text className="text-text-mute dark:text-text-dim-dark text-sm mt-1">
                {m.games} partidas · {m.wins}V-{m.losses}D
              </Text>
            </View>
            {m.display != null ? (
              <Text className="text-2xl font-bold text-primary">{m.display.toFixed(1)}</Text>
            ) : (
              <Text className="text-text-mute dark:text-text-dim-dark">—</Text>
            )}
          </View>
        </Card>
      ))}
    </View>
  );
}
