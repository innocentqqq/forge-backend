import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Banner, GroupLabel, Screen, Toggle } from '../components/ui';
import { Icon, icons, type IconName } from '../components/icons';
import { api } from '../lib/api';
import { fonts } from '../lib/fonts';
import { colors, outlined, radius } from '../lib/theme';
import type { NotificationSettings } from '../lib/types';

const DEFAULT_SETTINGS: NotificationSettings = {
  email: true,
  push: true,
  orderUpdates: true,
  promotions: false,
};

type RowConfig = {
  key: keyof NotificationSettings;
  icon: IconName;
  label: string;
  detail: string;
};

const ORDER_ROWS: RowConfig[] = [
  { key: 'orderUpdates', icon: icons.bell, label: 'Order updates', detail: 'Printing status and pickup alerts' },
  { key: 'email', icon: icons.mail, label: 'New messages', detail: 'Replies from printer labs' },
];

const OTHER_ROWS: RowConfig[] = [
  { key: 'promotions', icon: icons.tag, label: 'Tips & promotions', detail: 'Offers and printing guides' },
  { key: 'push', icon: icons.shield, label: 'Account alerts', detail: 'Security and login alerts' },
];

export default function NotificationsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getProfile()
      .then((profile) => setSettings(profile.notifications))
      .catch(() => undefined);
  }, []);

  const toggle = (key: keyof NotificationSettings, value: boolean) => {
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setError('');
    api.updateProfile({ notifications: next }).catch((err) => {
      setSettings(previous);
      setError(err instanceof Error ? err.message : 'Could not save your preferences');
    });
  };

  return (
    <Screen>
      <AppHeader back title="Notifications" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {error ? <Banner message={error} /> : null}

        <GroupLabel>Print activity</GroupLabel>
        <View style={styles.card}>
          {ORDER_ROWS.map((row) => (
            <SettingToggleRow
              key={row.key}
              icon={row.icon}
              label={row.label}
              detail={row.detail}
              value={settings[row.key]}
              onChange={(value) => toggle(row.key, value)}
            />
          ))}
        </View>

        <GroupLabel style={styles.groupGap}>Preferences</GroupLabel>
        <View style={styles.card}>
          {OTHER_ROWS.map((row) => (
            <SettingToggleRow
              key={row.key}
              icon={row.icon}
              label={row.label}
              detail={row.detail}
              value={settings[row.key]}
              onChange={(value) => toggle(row.key, value)}
            />
          ))}
        </View>
        <Text style={styles.footnote}>
          Pickup alerts are always sent while you have an active order, even if order updates are turned off.
        </Text>
      </ScrollView>
    </Screen>
  );
}

function SettingToggleRow({
  icon,
  label,
  detail,
  value,
  onChange,
}: {
  icon: IconName;
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWell}>
        <Icon name={icon} size={18} color={colors.text} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Toggle value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 8 },
  groupGap: { marginTop: 14 },
  footnote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 12 },

  card: { ...outlined, paddingHorizontal: 14, paddingVertical: 6, gap: 0 },
  divider: { height: 1, backgroundColor: colors.surfaceSubtle },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 17, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },
});
