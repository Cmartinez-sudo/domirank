import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui';

type Row = { rank: number | null; created_at: string };

type Streak = { current: number; type: 'W' | 'L' | 'none'; longestW: number; longestL: number };

function computeStreak(rows: Row[]): Streak {
  const withOutcome = rows.filter((r) => r.rank != null);
  if (withOutcome.length === 0) return { current: 0, type: 'none', longestW: 0, longestL: 0 };

  const won = (r: Row) => r.rank === 1;

  const first = withOutcome[0]!;
  const type: 'W' | 'L' = won(first) ? 'W' : 'L';
  let current = 0;
  for (const r of withOutcome) {
    if ((won(r) ? 'W' : 'L') === type) current += 1;
    else break;
  }

  let longestW = 0;
  let longestL = 0;
  let runW = 0;
  let runL = 0;
  for (const r of withOutcome) {
    if (won(r)) {
      runW += 1;
      runL = 0;
      longestW = Math.max(longestW, runW);
    } else {
      runL += 1;
      runW = 0;
      longestL = Math.max(longestL, runL);
    }
  }
  return { current, type, longestW, longestL };
}

export function StreaksSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['profile', 'streaks', userId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from('match_players')
        .select('rank, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card padding="md">
        <View className="py-2 items-center">
          <ActivityIndicator />
        </View>
      </Card>
    );
  }

  const s = computeStreak(data ?? []);
  if (s.type === 'none') return null;

  const currentLabel =
    s.type === 'W' ? `${s.current} victoria${s.current > 1 ? 's' : ''} al hilo` : `${s.current} derrota${s.current > 1 ? 's' : ''} al hilo`;
  const currentColor = s.type === 'W' ? 'text-primary' : 'text-danger';

  return (
    <Card padding="md">
      <Text className="text-lg font-bold text-text dark:text-text-inverse mb-3">Rachas</Text>
      <View className="gap-2">
        <View className="flex-row justify-between">
          <Text className="text-text-mute dark:text-text-dim-dark">Actual</Text>
          <Text className={`font-semibold ${currentColor}`}>{currentLabel}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-text-mute dark:text-text-dim-dark">Máxima de victorias</Text>
          <Text className="text-text dark:text-text-inverse font-semibold">{s.longestW}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-text-mute dark:text-text-dim-dark">Máxima de derrotas</Text>
          <Text className="text-text dark:text-text-inverse font-semibold">{s.longestL}</Text>
        </View>
      </View>
    </Card>
  );
}
