import { Text, View } from 'react-native';

import { Card } from '@/components/ui';
import type { ProfileRatingsRow } from '@/hooks/useProfile';

function pct(w: number, l: number): string {
  const total = w + l;
  if (total === 0) return '—';
  return `${Math.round((w / total) * 100)}%`;
}

export function StatTiles({ profile }: { profile: ProfileRatingsRow }) {
  const wins = profile.total_wins ?? 0;
  const losses = profile.total_losses ?? 0;
  const games = profile.total_games ?? 0;

  return (
    <View className="flex-row flex-wrap gap-3">
      <View className="flex-1 min-w-[45%]">
        <Card padding="md">
          <Text className="text-3xl font-bold text-text dark:text-text-inverse">{games}</Text>
          <Text className="text-text-mute dark:text-text-dim-dark text-sm">Partidas</Text>
        </Card>
      </View>
      <View className="flex-1 min-w-[45%]">
        <Card padding="md">
          <Text className="text-3xl font-bold text-primary">{wins}</Text>
          <Text className="text-text-mute dark:text-text-dim-dark text-sm">Victorias</Text>
        </Card>
      </View>
      <View className="flex-1 min-w-[45%]">
        <Card padding="md">
          <Text className="text-3xl font-bold text-danger">{losses}</Text>
          <Text className="text-text-mute dark:text-text-dim-dark text-sm">Derrotas</Text>
        </Card>
      </View>
      <View className="flex-1 min-w-[45%]">
        <Card padding="md">
          <Text className="text-3xl font-bold text-text dark:text-text-inverse">{pct(wins, losses)}</Text>
          <Text className="text-text-mute dark:text-text-dim-dark text-sm">Efectividad</Text>
        </Card>
      </View>
    </View>
  );
}
