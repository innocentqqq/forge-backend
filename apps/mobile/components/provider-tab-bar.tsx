import { type BottomTabBarProps } from 'expo-router/js-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, icons, statefulIcon, type IconName } from './icons';
import { fonts } from '../lib/fonts';
import { colors, radius, sectionPalettes, type AppSection } from '../lib/theme';

type ProviderTab = { label: string; icon: IconName; section: AppSection };

const PROVIDER_TABS: Record<string, ProviderTab> = {
  index: { label: 'Dashboard', icon: icons.home, section: 'dashboard' },
  orders: { label: 'Jobs', icon: icons.briefcase, section: 'jobs' },
  settings: { label: 'Shop', icon: icons.settings, section: 'shop' },
};

export function ProviderTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const focusedRoute = state.routes[state.index];
  const routes = state.routes.filter((route) => route.name in PROVIDER_TABS);

  return (
    <View style={[styles.bar, { bottom: Math.max(14, insets.bottom + 8) }]}>
      <View style={styles.modePill}>
        <View style={styles.modeDot} />
        <Text style={styles.modeLabel}>PROVIDER MODE</Text>
      </View>
      <View style={styles.tabs}>
        {routes.map((route) => {
          const tab = PROVIDER_TABS[route.name];
          if (!tab) return null;
          const focused = focusedRoute?.key === route.key;
          const palette = sectionPalettes[tab.section];

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => {
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigateToTab(route.key);
                }
              }}
              style={styles.item}
            >
              <Icon
                name={statefulIcon(tab.icon, focused)}
                size={22}
                color={focused ? palette.accent : colors.accentSoft}
              />
              <Text style={[styles.label, focused && { color: palette.accent, fontFamily: fonts.bold }]}>
                {tab.label}
              </Text>
              <View
                style={[
                  styles.indicator,
                  focused && { backgroundColor: palette.accent },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 15,
    right: 15,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 2,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  modeDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },
  modeLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.accentSoft,
  },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  item: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.accentSoft },
  labelActive: { fontFamily: fonts.bold, color: colors.bg },
  indicator: { width: 20, height: 2, borderRadius: radius.pill, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: colors.success },
});
