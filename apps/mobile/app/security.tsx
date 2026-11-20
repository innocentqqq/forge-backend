import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { icons } from '../components/icons';
import {
  AppHeader,
  Banner,
  Button,
  ScreenScroll,
  SectionTitle,
  SettingRow,
  TextField,
} from '../components/ui';
import { useAuth } from '../lib/auth';
import { fonts } from '../lib/fonts';
import { colors, radius } from '../lib/theme';

const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function sessionDate(value?: string | null): string {
  if (!value) return 'This device';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'This device'
    : `This device · last sign-in ${date.toLocaleDateString()}`;
}

export default function SecurityScreen() {
  const {
    user,
    updatePassword,
    requestPasswordReset,
    resendConfirmation,
    signOut,
  } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<'reset' | 'verify' | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const email = user?.email ?? '';
  const verified = Boolean(user?.email_confirmed_at);

  const changePassword = async () => {
    setError('');
    setNotice('');
    if (!PASSWORD_PATTERN.test(password)) {
      setError('Use at least 8 characters with a number and a symbol.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await updatePassword(password);
      setPassword('');
      setConfirm('');
      setNotice('Password updated. You are still signed in on this device.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password');
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async () => {
    if (!email) return;
    setError('');
    setNotice('');
    setSending('reset');
    try {
      await requestPasswordReset(email);
      setNotice(`Password reset link sent to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link');
    } finally {
      setSending(null);
    }
  };

  const resendVerification = async () => {
    if (!email) return;
    setError('');
    setNotice('');
    setSending('verify');
    try {
      await resendConfirmation(email);
      setNotice(`Verification email sent to ${email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the verification email');
    } finally {
      setSending(null);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Log out?', 'You will need to sign in again to place or manage orders.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          void signOut().catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Could not log out');
            setSigningOut(false);
          });
        },
      },
    ]);
  };

  return (
    <ScreenScroll contentStyle={styles.content}>
      <AppHeader back />
      <Text style={styles.title}>Security</Text>
      <Text style={styles.subtitle}>
        Manage your password, email verification, and active sign-in.
      </Text>

      {error ? <Banner message={error} /> : null}
      {notice ? <Banner tone="success" message={notice} /> : null}

      <SectionTitle>Change password</SectionTitle>
      <View style={styles.card}>
        <TextField
          label="New password"
          icon={icons.lock}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="At least 8 characters"
        />
        <TextField
          label="Confirm new password"
          icon={icons.lock}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Re-enter your password"
        />
        <Text style={styles.hint}>Use 8+ characters with a number and a symbol.</Text>
        <Button
          title="Update password"
          onPress={() => void changePassword()}
          loading={saving}
          disabled={!password || !confirm}
        />
      </View>

      <SectionTitle>Account recovery</SectionTitle>
      <View style={styles.card}>
        <Text style={styles.rowLabel}>Account email</Text>
        <Text style={styles.rowValue}>{email || 'No email on this account'}</Text>
        <Text style={styles.status}>{verified ? 'Email verified' : 'Email not verified yet'}</Text>
        <Button
          title="Email me a reset link"
          variant="secondary"
          onPress={() => void sendReset()}
          loading={sending === 'reset'}
          disabled={!email}
        />
        {!verified ? (
          <Button
            title="Resend verification email"
            variant="secondary"
            onPress={() => void resendVerification()}
            loading={sending === 'verify'}
            disabled={!email}
          />
        ) : null}
      </View>

      <SectionTitle>Active sign-in</SectionTitle>
      <View style={styles.card}>
        <SettingRow
          icon={icons.shield}
          title="This device"
          detail={sessionDate(user?.last_sign_in_at)}
        />
        <SettingRow
          icon={icons.logout}
          title="Log out"
          detail="End the session on this device"
          danger
          onPress={confirmSignOut}
        />
      </View>
      {signingOut ? <Text style={styles.hint}>Signing out…</Text> : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, gap: 12 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  rowLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  rowValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  status: { fontFamily: fonts.regular, fontSize: 12, color: colors.link },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },
});
