import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppHeader } from '@/components/AppHeader';
import { HamburgerDrawer } from '@/components/HamburgerDrawer';
import { CreateSheet } from '@/components/CreateSheet';
import { HomeIcon } from '@/components/icons/HomeIcon';
import { PodiumIcon } from '@/components/icons/PodiumIcon';
import { PlusIcon } from '@/components/icons/PlusIcon';
import { GroupsIcon } from '@/components/icons/GroupsIcon';
import { UserIcon } from '@/components/icons/UserIcon';

const PRIMARY = '#10b981';
const MUTED = '#64748b';

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sheetRef = useRef<BottomSheetModal>(null);

  const openSheet = () => sheetRef.current?.present();

  return (
    <GestureHandlerRootView className="flex-1">
      <BottomSheetModalProvider>
        <View className="flex-1 bg-bg dark:bg-bg-dark">
          <AppHeader onMenuPress={() => setDrawerOpen(true)} />

          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarShowLabel: true,
              tabBarActiveTintColor: PRIMARY,
              tabBarInactiveTintColor: MUTED,
              tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
              tabBarStyle: {
                borderTopWidth: 1,
                borderTopColor: '#e2e8f0',
                height: 62,
                paddingBottom: 6,
                paddingTop: 6,
              },
            }}
          >
            <Tabs.Screen
              name="dashboard"
              options={{
                title: 'Inicio',
                tabBarIcon: ({ color }) => <HomeIcon color={String(color)} />,
              }}
            />
            <Tabs.Screen
              name="leaderboard"
              options={{
                title: 'Ranking',
                tabBarIcon: ({ color }) => <PodiumIcon color={String(color)} />,
              }}
            />
            <Tabs.Screen
              name="create"
              options={{
                title: '',
                tabBarIcon: () => null,
                tabBarButton: () => (
                  <Pressable
                    onPress={openSheet}
                    accessibilityLabel="Crear"
                    className="flex-1 items-center justify-center"
                  >
                    <View
                      className="w-14 h-10 rounded-xl bg-primary items-center justify-center"
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 6,
                        elevation: 6,
                      }}
                    >
                      <PlusIcon color="#ffffff" />
                    </View>
                  </Pressable>
                ),
              }}
              listeners={{
                tabPress: (e) => e.preventDefault(),
              }}
            />
            <Tabs.Screen
              name="groups"
              options={{
                title: 'Grupos',
                tabBarIcon: ({ color }) => <GroupsIcon color={String(color)} />,
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: 'Perfil',
                tabBarIcon: ({ color }) => <UserIcon color={String(color)} />,
              }}
            />
          </Tabs>

          <HamburgerDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          <CreateSheet ref={sheetRef} />
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
