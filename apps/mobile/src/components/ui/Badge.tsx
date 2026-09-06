import { Text, View } from 'react-native';

type Variant = 'default' | 'beta' | 'success' | 'danger';

type Props = {
  label: string;
  variant?: Variant;
};

const variantClasses: Record<Variant, { bg: string; text: string }> = {
  default: {
    bg: 'bg-surface-2 dark:bg-surface-2-dark',
    text: 'text-text-mute dark:text-text-dim-dark',
  },
  beta: {
    bg: 'bg-primary/15',
    text: 'text-primary',
  },
  success: {
    bg: 'bg-primary/15',
    text: 'text-primary',
  },
  danger: {
    bg: 'bg-danger/15',
    text: 'text-danger',
  },
};

export function Badge({ label, variant = 'default' }: Props) {
  const v = variantClasses[variant];
  return (
    <View className={`px-2 py-0.5 rounded-full ${v.bg}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wide ${v.text}`}>{label}</Text>
    </View>
  );
}
