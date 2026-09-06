import { forwardRef, useCallback, useMemo } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import { PlusIcon } from '@/components/icons/PlusIcon';
import { TrophyIcon } from '@/components/icons/TrophyIcon';
import { GroupsIcon } from '@/components/icons/GroupsIcon';

export const CreateSheet = forwardRef<BottomSheetModal>((_, ref) => {
  const snapPoints = useMemo(() => ['40%'], []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
      />
    ),
    [],
  );

  const wip = (what: string) => {
    Alert.alert('Próximamente', `${what} — llega en una semana futura del port.`);
  };

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#ffffff' }}
      handleIndicatorStyle={{ backgroundColor: '#cbd5e1' }}
    >
      <BottomSheetView className="flex-1 px-4 pt-2 pb-6">
        <Text className="text-lg font-bold text-text mb-4 px-2">Crear</Text>
        <View className="gap-2">
          <CreateOption
            icon={<PlusIcon size={22} color="#10b981" />}
            title="Crear match"
            subtitle="Registrá una partida nueva."
            onPress={() => wip('Crear match')}
          />
          <CreateOption
            icon={<GroupsIcon size={22} color="#10b981" />}
            title="Crear grupo"
            subtitle="Invitá amigos a un grupo privado."
            onPress={() => wip('Crear grupo')}
          />
          <CreateOption
            icon={<TrophyIcon size={22} color="#10b981" />}
            title="Crear torneo"
            subtitle="Arma un torneo con roster y formato."
            onPress={() => wip('Crear torneo')}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

CreateSheet.displayName = 'CreateSheet';

function CreateOption({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center gap-3 p-4 rounded-xl bg-surface-2 active:opacity-70"
    >
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
        {icon}
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-text">{title}</Text>
        <Text className="text-sm text-text-mute">{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}
