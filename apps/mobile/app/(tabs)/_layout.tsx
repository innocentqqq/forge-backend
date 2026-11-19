import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, icons, type IconName } from '../../components/icons';
import { fonts } from '../../lib/fonts';
import { colors, radius } from '../../lib/theme';

type TabConfig = { label: string; icon: IconName };

const TABS: Record<string, TabConfig> = {
  index: { label: 'Home', icon: icons.home },
  orders: { label: 'Orders', icon: icons.orders },
  profile: { label: 'Profile', icon: icons.profile },
};

function ForgeTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const focusedRoute = state.routes[state.index];
  const routes = state.routes.filter((route) => route.name in TABS);

  return (
    <View style={[styles.bar, { bottom: Math.max(14, insets.bottom + 8) }]}>
      {routes.map((route) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = focusedRoute?.key === route.key;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigateToTab(route.key);
              }
            }}
            style={({ pressed }) => [styles.item, focused && styles.itemActive, pressed && styles.pressed]}
          >
            <Icon name={tab.icon} size={20} color={focused ? colors.accent : colors.text} />
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      tabBar={(props) => <ForgeTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 15,
    right: 15,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    gap: 6,
  },
  item: { flex: 1, height: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', gap: 3 },
  itemActive: { backgroundColor: colors.bg },
  pressed: { opacity: 0.7 },
  label: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.text },
  labelActive: { fontFamily: fonts.semibold, color: colors.accent },
});
