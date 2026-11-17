import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Banner, Button, LoadingView, Screen, TextField } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { api } from '../lib/api';
import { fonts } from '../lib/fonts';
import { colors, radius } from '../lib/theme';
import type { Profile } from '../lib/types';

export default function EditProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then((result) => {
        setProfile(result);
        setName(result.fullName ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load profile'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateProfile({ fullName: name.trim() || null });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader back />
        <LoadingView label="Loading profile…" />
      </Screen>
    );
  }

  const displayName = name.trim() || profile?.fullName?.trim() || 'Forge Maker';
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Screen>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Edit profile</Text>

        <View style={styles.account}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{profile?.email ?? ''}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <TextField
            label="Full name"
            icon={icons.user}
            value={name}
            onChangeText={setName}
            placeholder="Jamie Doe"
            autoComplete="name"
          />
          <TextField
            label="Email"
            icon={icons.mail}
            value={profile?.email ?? ''}
            editable={false}
            placeholder="you@example.com"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert('University', 'Your university is managed by your Forge account administrator.')}
          style={({ pressed }) => [styles.university, pressed && styles.pressed]}
        >
          <View style={styles.universityLeft}>
            <Icon name={icons.university} size={24} color={colors.text} />
            <Text style={styles.universityName}>{profile?.email?.split('@')[1] ?? 'Myanmar Tech University'}</Text>
          </View>
          <Icon name={icons.chevronRight} size={16} color={colors.muted} />
        </Pressable>

        {error ? <Banner message={error} /> : null}

        <Button title="Save changes" onPress={() => void save()} loading={saving} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 16 },
  pressed: { opacity: 0.85 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },

  account: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24.2, color: colors.text },
  accountCopy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  email: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },

  university: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  universityLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  universityName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
});
