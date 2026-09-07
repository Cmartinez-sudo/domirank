import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useProfileByUsername } from '@/hooks/useProfile';
import { Button } from '@/components/ui';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { StatTiles } from '@/components/profile/StatTiles';
import { EloCurveSection } from '@/components/profile/EloCurveSection';
import { StreaksSection } from '@/components/profile/StreaksSection';
import { ModalityCards } from '@/components/profile/ModalityCards';
import { HistoryList } from '@/components/profile/HistoryList';

export default function ProfileTab() {
  const { user, signOut } = useAuth();
  const [username, setUsername] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setUsername(data?.username ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const { data: profile, isLoading } = useProfileByUsername(username ?? undefined);

  const onSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    // AuthGuard reacts via onAuthStateChange → redirects to /login.
  };

  if (isLoading || !profile || !profile.id) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const userId = profile.id;

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="px-4 pb-8">
        <ProfileHero profile={profile} />

        <View className="gap-6 mt-2">
          <StatTiles profile={profile} />
          <EloCurveSection userId={userId} />
          <StreaksSection userId={userId} />
          <ModalityCards profile={profile} />
          <HistoryList userId={userId} />

          <View className="mt-4">
            <Text className="text-text-mute dark:text-text-dim-dark text-xs mb-2">
              Cuenta: {user?.email}
            </Text>
            <Button
              label={signingOut ? 'Cerrando...' : 'Cerrar sesión'}
              variant="danger"
              onPress={onSignOut}
              loading={signingOut}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
