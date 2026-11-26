import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import {
  AuthFooterLink,
  AuthScreen,
  SocialAuthButtons,
  type OAuthProvider,
} from '../../components/auth';
import { Banner, Button, TextField } from '../../components/ui';
import { icons } from '../../components/icons';
import { useAuth } from '../../lib/auth';
import { fonts } from '../../lib/fonts';
import { colors } from '../../lib/theme';

export default function SignUpScreen() {
  const { signUp, signInWithOAuth } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  const oauth = async (provider: OAuthProvider) => {
    setError(null);
    setOauthLoading(provider);
    try {
      await signInWithOAuth(provider, 'signup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue with that provider');
    } finally {
      setOauthLoading(null);
    }
  };

  const submit = async () => {
    setError(null);
    if (!/^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
      setError('Use at least 8 characters with a number and a symbol.');
      return;
    }
    setLoading(true);
    try {
      const { needsConfirmation } = await signUp(email, password, fullName);
      if (needsConfirmation) router.replace({ pathname: '/check-your-email', params: { email, kind: 'signup' } });
      else router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Create your account."
      description="Full name · email address · password · Google sign-in."
      footer={<AuthFooterLink prompt="Already have an account?" action="Log in" onPress={() => router.push('/sign-in')} />}
      terms="By creating an account, you agree to Forge’s Terms of Service and Privacy Policy."
    >
      {error ? <Banner message={error} /> : null}
      <SocialAuthButtons onPress={oauth} loading={oauthLoading} />
      <TextField label="Full name" icon={icons.user} value={fullName} onChangeText={setFullName} placeholder="Your name" autoComplete="name" />
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
        placeholder="Create a secure password"
      />
      <Text style={styles.hint}>Use 8+ characters with a number and a symbol.</Text>
      <Button title="Create account" onPress={submit} loading={loading} disabled={!fullName || !email || !password} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },
});
