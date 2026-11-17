import React from 'react';
import { View } from 'react-native';
import { AppHeader, PageTitle, SectionTitle, SettingRow, Subtitle } from './ui';

/**
 * Thin wrappers kept so screens can share the Forge chrome. Everything real
 * lives in components/ui.tsx, which mirrors the Figma design system.
 */

export function ForgeHeader({ back = false }: { back?: boolean }) {
  return <AppHeader back={back} />;
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <PageTitle>{title}</PageTitle>
      {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
    </View>
  );
}

export { SectionTitle as SectionLabel, SettingRow };
