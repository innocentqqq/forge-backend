import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, ErrorView, LoadingView, Screen, SettingRow } from '../../components/ui';
import { icons, type IconName } from '../../components/icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fonts } from '../../lib/fonts';
import { colors, outlined, radius } from '../../lib/theme';
import type { Profile, ProfileStats } from '../../lib/types';

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextProfile, nextStats] = await Promise.all([
        api.getProfile(),
        api.getProfileStats().catch(() => null),
      ]);
      setProfile(nextProfile);
      setStats(nextStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) return <Screen><AppHeader compact /><LoadingView label="Loading profile…" /></Screen>;
  if (error || !profile) {
    return <Screen><AppHeader compact /><ErrorView message={error || 'Profile unavailable'} onRetry={() => void load()} /></Screen>;
  }

  const name = profile.fullName?.trim() || 'Forge Maker';
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const prints = stats?.printsCompleted ?? 0;

  return (
    <Screen>
      <AppHeader compact />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Profile</Text>
          <Pressable onPress={() => router.push('/edit-profile')} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
            <Text style={styles.editPillText}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={styles.summary}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{profile.email}</Text>
            <Text style={styles.plan}>Maker account · {prints} prints completed</Text>
          </View>
        </View>

        <Section
          title="Account"
          rows={[
            { icon: icons.user, title: 'Personal details', detail: 'Name, email and contact information', to: '/edit-profile' },
            { icon: icons.printer, title: 'Printers & lab', detail: 'Saved printers and pickup spots', to: '/printers' },
          ]}
        />

        <Section
          title="Settings"
          rows={[
            { icon: icons.bell, title: 'Notifications & preferences', detail: 'Print updates, nearby makers and units', to: '/notifications' },
            { icon: icons.shield, title: 'Security', detail: 'Password and account protection', to: '/forgot-password' },
          ]}
        />

        <Section
          title="Help"
          rows={[
            { icon: icons.help, title: 'Support', detail: 'Help center and contact Forge', to: '/help' },
            { icon: icons.logout, title: 'Log out', detail: 'Sign out of this device', danger: true, onPress: () => void signOut() },
          ]}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/provider')}
          style={({ pressed }) => [styles.maker, pressed && styles.pressed]}
        >
          <Text style={styles.makerTitle}>Maker mode</Text>
          <Text style={styles.makerCopy}>List your printer and earn from print jobs nearby.</Text>
          <View style={styles.makerButton}>
            <Text style={styles.makerButtonText}>{profile.provider ? 'Open provider dashboard' : 'Become a provider'}</Text>
          </View>
        </Pressable>

        <View style={{ height: 110 }} />
      </ScrollView>
    </Screen>
  );
}

type Row = {
  icon: IconName;
  title: string;
  detail?: string;
  to?: string;
  danger?: boolean;
  onPress?: () => void;
};

function Section({ title, rows }: { title: string; rows: Row[] }) {
  const router = useRouter();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {rows.map((row, index) => (
          <React.Fragment key={row.title}>
            {index > 0 ? <View style={styles.rowDivider} /> : null}
            <SettingRow
              icon={row.icon}
              title={row.title}
              detail={row.detail}
              danger={row.danger}
              onPress={row.onPress ?? (() => router.push(row.to as never))}
            />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 16 },
  pressed: { opacity: 0.75 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, letterSpacing: -0.3, color: colors.text },
  editPillText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 15.7, color: colors.accent },

  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 4 },
  avatar: { width: 62, height: 62, borderRadius: radius.pill, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 24.2, color: colors.text },
  summaryCopy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  email: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  plan: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 13.3, color: colors.link, marginTop: 2 },

  section: { marginTop: 22 },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 15.7,
    color: colors.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionCard: { ...outlined, paddingHorizontal: 14, paddingVertical: 4, overflow: 'hidden' },
  rowDivider: { height: 1, backgroundColor: '#EEF1F7' },

  maker: { marginTop: 22, borderRadius: radius.md, backgroundColor: colors.accentSoft, padding: 18, gap: 4 },
  makerTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  makerCopy: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.text, opacity: 0.8 },
  makerButton: { marginTop: 12, alignSelf: 'flex-start', backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 9 },
  makerButtonText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 17, color: colors.link },
});
