import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthFooterLink, AuthScreen } from '../../components/auth';
import { Banner, Button, TextField } from '../../components/ui';
import { icons } from '../../components/icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { fonts } from '../../lib/fonts';
import { colors } from '../../lib/theme';

export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    void supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) setError(exchangeError.message);
    });
  }, [code]);

  const submit = async () => {
    setError(null);
    if (!/^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) return setError('Use at least 8 characters with a number and a symbol.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try { await updatePassword(password); router.replace('/sign-in'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not reset password'); }
    finally { setLoading(false); }
  };

  return (
    <AuthScreen
      title="Reset password"
      description="Create a new password for your account."
      footer={<AuthFooterLink prompt="Remembered it?" action="Log in" onPress={() => router.push('/sign-in')} />}
    >
      {error ? <Banner message={error} /> : null}
      <TextField
        label="New password"
        icon={icons.lock}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Create a new password"
      />
      <TextField
        label="Confirm password"
        icon={icons.lock}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        placeholder="Re-enter your password"
      />
      <Text style={styles.hint}>Use 8+ characters with a number and a symbol.</Text>
      <Button title="Reset password" onPress={submit} loading={loading} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },
});
