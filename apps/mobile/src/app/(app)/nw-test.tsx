import { Text, View } from 'react-native';

import { DEFAULT_ELO } from '@domirank/shared/rating';

export default function NativeWindTest() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-green-500 text-2xl font-bold">Hello DomiRank Mobile</Text>
      <Text className="text-gray-500 mt-2">DEFAULT_ELO from shared: {DEFAULT_ELO}</Text>
    </View>
  );
}
