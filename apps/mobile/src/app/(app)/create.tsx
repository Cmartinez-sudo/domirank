// Stub route required by Expo Router so <Tabs.Screen name="create" /> in the
// tab bar has a matching file. The tab button is overridden with a custom
// tabBarButton that opens the CreateSheet instead of navigating here, and the
// tabPress listener calls preventDefault(). This screen should never render;
// if it does, it means the intercept broke — the empty View is a safe fallback.
import { View } from 'react-native';

export default function CreatePlaceholder() {
  return <View />;
}
