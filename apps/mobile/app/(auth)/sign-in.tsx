import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AuthFooterLink,
  AuthScreen,
  SocialAuthButtons,
  type OAuthProvider,
} from '../../components/auth';
import { Banner, Button, TextField } from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { useAuth } from '../../lib/auth';
import { fonts } from '../../lib/fonts';
import { colors, radius, touchTarget } from '../../lib/theme';

export default function SignInScreen() {
  const { signIn, signInWithOAuth } = useAuth();
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(
    reason === 'no-account'
      ? 'No account found for that provider. Create one to sign in.'
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  const oauth = async (provider: OAuthProvider) => {
    setError(null);
    setOauthLoading(provider);
    try {
      await signInWithOAuth(provider, 'signin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue with that provider');
    } finally {
      setOauthLoading(null);
    }
  };

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Welcome back"
      description="Sign in to upload designs, find nearby printers, and track every print."
      footer={<AuthFooterLink prompt="New to Forge?" action="Sign up" onPress={() => router.push('/sign-up')} />}
    >
      {error ? <Banner message={error} /> : null}
      <SocialAuthButtons onPress={oauth} loading={oauthLoading} />
      <TextField
        label="Email"
        icon={icons.mail}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        icon={icons.lock}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Enter your password"
        autoComplete="password"
      />
      <View style={styles.options}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Remember me"
          accessibilityState={{ checked: remember }}
          onPress={() => setRemember(!remember)}
          style={styles.remember}
        >
          <View style={[styles.checkbox, remember && styles.checkboxOn]}>
            {remember ? <Icon name={icons.check} size={12} color="#FFFFFF" /> : null}
          </View>
          <Text style={styles.rememberText}>Remember me</Text>
        </Pressable>
        <Text accessibilityRole="link" onPress={() => router.push('/forgot-password')} style={styles.link}>
          Forgot password?
        </Text>
      </View>
      <Button title="Log in" onPress={submit} loading={loading} disabled={!email || !password} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: touchTarget },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  rememberText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.link },
});
