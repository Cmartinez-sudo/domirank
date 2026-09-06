import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProfileByUsername } from '@/hooks/useProfile';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { StatTiles } from '@/components/profile/StatTiles';
import { EloCurveSection } from '@/components/profile/EloCurveSection';
import { StreaksSection } from '@/components/profile/StreaksSection';
import { ModalityCards } from '@/components/profile/ModalityCards';
import { HistoryList } from '@/components/profile/HistoryList';
import { FriendActionButton } from '@/components/profile/FriendActionButton';

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { data: profile, isLoading, error } = useProfileByUsername(username);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <Stack.Screen options={{ title: '' }} />
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (error || !profile || !profile.id) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark px-6">
        <Stack.Screen options={{ title: 'Perfil' }} />
        <Text className="text-lg font-semibold text-text dark:text-text-inverse mb-2">
          Perfil no encontrado
        </Text>
        <Text className="text-text-mute dark:text-text-dim-dark text-center">
          No pudimos cargar @{username}. ¿Estás seguro del nombre de usuario?
        </Text>
      </SafeAreaView>
    );
  }

  const userId = profile.id;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <Stack.Screen options={{ title: profile.display_name ?? `@${profile.username ?? ''}` }} />
      <ScrollView contentContainerClassName="px-4 pb-8">
        <ProfileHero
          profile={profile}
          actionSlot={<FriendActionButton targetUserId={userId} />}
        />

        <View className="gap-6 mt-2">
          <StatTiles profile={profile} />
          <EloCurveSection userId={userId} />
          <StreaksSection userId={userId} />
          <ModalityCards profile={profile} />
          <HistoryList userId={userId} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
