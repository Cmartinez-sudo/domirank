import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
};

const variantClasses: Record<Variant, { container: string; text: string }> = {
  primary: {
    container: 'bg-primary active:opacity-80',
    text: 'text-primary-ink',
  },
  secondary: {
    container:
      'bg-surface dark:bg-surface-dark border border-border dark:border-surface-2-dark active:opacity-80',
    text: 'text-text dark:text-text-inverse',
  },
  ghost: {
    container: 'bg-transparent active:opacity-60',
    text: 'text-primary',
  },
  danger: {
    container:
      'bg-transparent border border-danger active:opacity-60',
    text: 'text-danger',
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  fullWidth = true,
}: Props) {
  const inactive = disabled || loading;
  const v = variantClasses[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={`${v.container} py-3 px-4 rounded-lg ${fullWidth ? 'w-full' : ''} ${
        inactive ? 'opacity-50' : ''
      }`}
    >
      <View className="flex-row items-center justify-center gap-2">
        {loading ? (
          <ActivityIndicator size="small" color={variant === 'primary' ? '#ffffff' : '#10b981'} />
        ) : icon ? (
          <View>{icon}</View>
        ) : null}
        <Text className={`text-center font-semibold ${v.text}`}>{label}</Text>
      </View>
    </Pressable>
  );
}
