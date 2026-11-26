import { useRouter } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNavigation, type BottomNavKey } from '../../components/ui';
import { colors } from '../../lib/theme';

const ROUTES: Record<BottomNavKey, string> = {
  discover: '/',
  nearby: '/nearby',
  upload: '/upload',
  orders: '/orders',
  profile: '/profile',
};

const TAB_KEYS: Record<string, BottomNavKey> = {
  index: 'discover',
  orders: 'orders',
  profile: 'profile',
};

function ForgeTabBar({ state }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focusedName = state.routes[state.index]?.name ?? 'index';
  const active = TAB_KEYS[focusedName] ?? 'discover';

  return (
    <View style={[styles.wrapper, { bottom: Math.max(10, insets.bottom) }]}>
      <BottomNavigation
        active={active}
        onPress={(key) => router.navigate(ROUTES[key] as never)}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <ForgeTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Discover' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 16, right: 16 },
});
