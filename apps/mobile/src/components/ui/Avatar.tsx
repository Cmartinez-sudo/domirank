import { Image, Text, View } from 'react-native';

type Props = {
  url?: string | null;
  name?: string | null;
  size?: number;
};

function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export function Avatar({ url, name, size = 40 }: Props) {
  const initials = initialsOf(name);
  const fontSize = Math.round(size * 0.4);

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      className="bg-primary items-center justify-center"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      <Text className="text-primary-ink font-bold" style={{ fontSize }}>
        {initials}
      </Text>
    </View>
  );
}
