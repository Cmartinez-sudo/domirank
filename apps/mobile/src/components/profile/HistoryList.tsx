import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui';

type HistoryRow = {
  id: number;
  match_id: string;
  created_at: string;
  rank: number | null;
  score: number;
  elo_after: number | null;
  elo_before: number | null;
  matches: { confirmed_at: string | null; count_rule: string | null; status: string } | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function HistoryList({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['profile', 'history', userId],
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from('match_players')
        .select('id, match_id, created_at, rank, score, elo_after, elo_before, matches(confirmed_at, count_rule, status)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as HistoryRow[];
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <View className="py-8 items-center">
        <ActivityIndicator />
      </View>
    );
  }

  const rows = (data ?? []).filter((r) => r.matches?.status === 'confirmed');

  if (rows.length === 0) {
    return (
      <Card padding="lg">
        <Text className="text-lg font-bold text-text dark:text-text-inverse mb-2">Historial</Text>
        <Text className="text-text-mute dark:text-text-dim-dark text-center py-2">
          Aún sin partidas registradas.
        </Text>
      </Card>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-lg font-bold text-text dark:text-text-inverse mb-1">Historial</Text>
      {rows.map((row) => {
        const won = row.rank === 1;
        const delta =
          row.elo_after != null && row.elo_before != null ? row.elo_after - row.elo_before : null;
        return (
          <Card key={row.id} padding="sm">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className={`text-sm font-bold ${won ? 'text-primary' : 'text-danger'}`}>
                  {won ? 'Victoria' : 'Derrota'}
                </Text>
                <Text className="text-text-mute dark:text-text-dim-dark text-xs mt-1">
                  {formatDate(row.matches?.confirmed_at ?? row.created_at)}
                  {row.matches?.count_rule ? ` · ${row.matches.count_rule}` : ''}
                </Text>
              </View>
              {delta != null ? (
                <Text
                  className={`text-sm font-semibold ${
                    delta >= 0 ? 'text-primary' : 'text-danger'
                  }`}
                >
                  {delta >= 0 ? '+' : ''}
                  {delta.toFixed(2)}
                </Text>
              ) : null}
            </View>
          </Card>
        );
      })}
    </View>
  );
}
