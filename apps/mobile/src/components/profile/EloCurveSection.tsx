import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Dimensions, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui';

type MatchPlayerRow = {
  elo_after: number | null;
  created_at: string;
};

export function EloCurveSection({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['profile', 'elo-history', userId],
    queryFn: async (): Promise<MatchPlayerRow[]> => {
      // Simple aggregation: last 40 match_players rows ordered by time. The
      // chart shows the raw elo_after trajectory. Post-MVP we can dedupe
      // per-day averages if it gets noisy.
      const { data, error } = await supabase
        .from('match_players')
        .select('elo_after, created_at')
        .eq('user_id', userId)
        .not('elo_after', 'is', null)
        .order('created_at', { ascending: true })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as MatchPlayerRow[];
    },
    staleTime: 60_000,
  });

  const points = useMemo(
    () =>
      (data ?? [])
        .filter((r) => typeof r.elo_after === 'number')
        .map((r) => ({ value: r.elo_after as number })),
    [data],
  );

  if (isLoading) {
    return (
      <Card padding="lg">
        <View className="py-4 items-center">
          <ActivityIndicator />
        </View>
      </Card>
    );
  }

  if (points.length < 2) {
    return (
      <Card padding="lg">
        <Text className="text-lg font-bold text-text dark:text-text-inverse mb-2">
          Evolución del rating
        </Text>
        <Text className="text-text-mute dark:text-text-dim-dark text-sm">
          Necesitamos al menos 2 partidas para dibujar la curva.
        </Text>
      </Card>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 64; // account for outer + inner padding

  return (
    <Card padding="md">
      <Text className="text-lg font-bold text-text dark:text-text-inverse mb-3">
        Evolución del rating
      </Text>
      <LineChart
        data={points}
        width={chartWidth}
        height={180}
        color="#10b981"
        thickness={2}
        curved
        hideDataPoints
        hideRules
        yAxisTextStyle={{ color: '#64748b', fontSize: 10 }}
        xAxisLabelTextStyle={{ color: '#64748b', fontSize: 10 }}
        xAxisColor="#e2e8f0"
        yAxisColor="#e2e8f0"
        initialSpacing={10}
        endSpacing={10}
      />
    </Card>
  );
}
