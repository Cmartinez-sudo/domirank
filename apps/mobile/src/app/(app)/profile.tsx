import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, Button } from '@/components/ui';

type ProfileRow = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
};

export default function Profile() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('full_name, username, avatar_url, date_of_birth')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile(data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const onSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    // AuthGuard reacts via onAuthStateChange → redirects to /login.
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg dark:bg-bg-dark">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const displayName = profile?.full_name ?? profile?.username ?? user?.email ?? 'Sin nombre';

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <ScrollView contentContainerClassName="px-6 py-8">
        <View className="items-center mb-8">
          <Avatar url={profile?.avatar_url} name={displayName} size={96} />
          <Text className="text-2xl font-bold text-text dark:text-text-inverse mt-4">
            {displayName}
          </Text>
          {user?.email ? (
            <Text className="text-text-mute dark:text-text-dim-dark mt-1">{user.email}</Text>
          ) : null}
        </View>

        <View className="gap-3 mb-8">
          <ProfileRow label="Username" value={profile?.username ?? '—'} />
          <ProfileRow label="Fecha de nacimiento" value={profile?.date_of_birth ?? '—'} />
        </View>

        <Button
          label={signingOut ? 'Cerrando...' : 'Cerrar sesión'}
          variant="danger"
          onPress={onSignOut}
          loading={signingOut}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-3 border-b border-border dark:border-surface-2-dark">
      <Text className="text-text-mute dark:text-text-dim-dark">{label}</Text>
      <Text className="text-text dark:text-text-inverse font-medium">{value}</Text>
    </View>
  );
}
