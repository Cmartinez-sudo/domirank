import { Text, View } from 'react-native';

export function PlaceholderScreen({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="flex-1 items-center justify-center px-6 bg-bg dark:bg-bg-dark">
      <Text className="text-3xl font-bold text-text dark:text-text-inverse mb-2">{title}</Text>
      <Text className="text-text-mute dark:text-text-dim-dark text-center">
        {subtitle ?? 'Próximamente'}
      </Text>
    </View>
  );
}
