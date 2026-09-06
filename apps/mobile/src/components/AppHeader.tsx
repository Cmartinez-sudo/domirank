import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BellIcon } from '@/components/icons/BellIcon';
import { MenuIcon } from '@/components/icons/MenuIcon';

export function AppHeader({ onMenuPress }: { onMenuPress: () => void }) {
  return (
    <SafeAreaView edges={['top']} className="bg-bg dark:bg-bg-dark">
      <View className="h-16 flex-row items-center justify-between px-4 border-b border-border dark:border-surface-2-dark">
        <Text className="text-2xl font-bold text-primary">DomiRank</Text>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity accessibilityLabel="Notificaciones" hitSlop={8}>
            <BellIcon color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMenuPress}
            accessibilityLabel="Abrir menú"
            hitSlop={8}
          >
            <MenuIcon color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
