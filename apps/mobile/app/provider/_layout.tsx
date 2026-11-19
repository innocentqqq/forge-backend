import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { ProviderTabBar } from '../../components/provider-tab-bar';
import { colors } from '../../lib/theme';

export default function ProviderLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.surfaceSubtle } }}
      tabBar={(props) => <ProviderTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="orders" options={{ title: 'Jobs' }} />
      <Tabs.Screen name="settings" options={{ title: 'Shop' }} />
    </Tabs>
  );
}
