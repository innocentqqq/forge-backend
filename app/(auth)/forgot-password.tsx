import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { AuthFooterLink, AuthScreen } from '../../components/auth';
import { Banner, Button, TextField } from '../../components/ui';
import { icons } from '../../components/icons';
import { useAuth } from '../../lib/auth';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      router.replace({ pathname: '/check-your-email' as never, params: { email, kind: 'reset' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title="Forgot password?"
      description="Enter your student email and we'll send you a reset link."
      footer={<AuthFooterLink prompt="Already have an account?" action="Log in" onPress={() => router.push('/sign-in')} />}
    >
      {error ? <Banner message={error} /> : null}
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
      <Button title="Send reset link" onPress={submit} loading={loading} disabled={!email} />
    </AuthScreen>
  );
}
