import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { TrophyIcon } from '@/components/icons/TrophyIcon';
import { UserIcon } from '@/components/icons/UserIcon';
import { useAuth } from '@/hooks/useAuth';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HamburgerDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const { signOut } = useAuth();

  const go = (path: '/tournaments' | '/profile') => {
    onClose();
    // Small delay so the drawer close animation doesn't race the navigation.
    setTimeout(() => {
      // /tournaments is not implemented yet as a route — the drawer link is a
      // placeholder that will 404 in Expo Router until Semana 8. Fine for
      // testing the drawer chrome; will wire when Torneos ships.
      router.push(path as never);
    }, 150);
  };

  const onSignOut = async () => {
    onClose();
    await signOut();
    // AuthGuard reacts on onAuthStateChange → redirect to /login.
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable onPress={onClose} className="flex-1 bg-black/50">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="absolute top-0 bottom-0 right-0 w-72 bg-bg dark:bg-bg-dark"
        >
          <SafeAreaView edges={['top', 'bottom']} className="flex-1">
            <View className="px-4 py-6 border-b border-border dark:border-surface-2-dark">
              <Text className="text-xl font-bold text-text dark:text-text-inverse">Menú</Text>
            </View>

            <View className="flex-1 px-2 py-4 gap-1">
              <DrawerLink
                icon={<TrophyIcon color="#64748b" />}
                label="Torneos"
                beta
                onPress={() => go('/tournaments')}
              />
              <DrawerLink
                icon={<UserIcon color="#64748b" />}
                label="Perfil"
                onPress={() => go('/profile')}
              />
            </View>

            <View className="px-4 py-4 border-t border-border dark:border-surface-2-dark">
              <Text
                onPress={onSignOut}
                className="text-center font-semibold py-3 rounded-lg border border-danger text-danger"
              >
                Cerrar sesión
              </Text>
            </View>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DrawerLink({
  icon,
  label,
  onPress,
  beta,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  beta?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center gap-3 px-3 py-3 rounded-lg active:bg-surface-2 dark:active:bg-surface-2-dark"
    >
      {icon}
      <Text className="flex-1 text-base text-text dark:text-text-inverse">{label}</Text>
      {beta ? (
        <Text className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
          beta
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}
