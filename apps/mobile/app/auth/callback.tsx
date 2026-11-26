import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Screen } from '../../components/ui';
import {
  clearOAuthIntent,
  isNewOAuthUser,
  readOAuthIntent,
  rejectNewOAuthAccount,
  signOutLocally,
} from '../../lib/oauth';
import { supabase } from '../../lib/supabase';
import { fonts } from '../../lib/fonts';
import { colors } from '../../lib/theme';

export default function AuthCallbackScreen() {
  const { code, error: authError, error_description: errorDescription } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const router = useRouter();
  // Read once: clearing the stored intent must not re-run the exchange effect.
  const [intent] = useState(() => readOAuthIntent());

  const initialError =
    errorDescription ??
    authError ??
    (code ? null : 'The confirmation link did not include a sign-in code. Request a new confirmation email.');

  const [error, setError] = useState<string | null>(initialError);
  const [finished, setFinished] = useState(Boolean(initialError));

  useEffect(() => {
    if (initialError || !code) {
      clearOAuthIntent();
      return;
    }

    let active = true;

    supabase.auth
      .exchangeCodeForSession(code)
      .then(async ({ data, error: exchangeError }) => {
        if (!active) return;
        if (exchangeError) {
          clearOAuthIntent();
          setError(exchangeError.message);
          setFinished(true);
          return;
        }

        try {
          // No stored intent means this tab did not start a social flow, so
          // this is the link from an email/password confirmation email.
          if (!intent) {
            clearOAuthIntent();
            router.replace({ pathname: '/auth/success', params: { method: 'email' } });
            return;
          }

          if (intent === 'signin') {
            // Supabase creates the account before the app can inspect it. The
            // API removes it when this exact OAuth sign-in created it, so the
            // sign-in screen cannot be used to register an unknown user.
            const deleted = await rejectNewOAuthAccount(data.session);
            if (deleted) {
              await signOutLocally();
              clearOAuthIntent();
              router.replace({ pathname: '/sign-in', params: { reason: 'no-account' } });
              return;
            }
          }

          const isNew = data.user ? isNewOAuthUser(data.user) : false;
          clearOAuthIntent();
          router.replace(intent === 'signup' && isNew ? '/auth/success' : '/');
        } catch (routeError) {
          if (!active) return;
          clearOAuthIntent();
          setError(
            routeError instanceof Error
              ? routeError.message
              : 'Sign-in did not complete. Try again.',
          );
          setFinished(true);
        }
      })
      .catch((exchangeError: unknown) => {
        if (!active) return;
        clearOAuthIntent();
        setError(
          exchangeError instanceof Error ? exchangeError.message : 'Could not complete email confirmation.',
        );
        setFinished(true);
      });

    return () => {
      active = false;
    };
  }, [code, initialError, router, intent]);

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>
          {error ? (intent ? 'Sign-in failed' : 'Confirmation failed') : 'Finishing sign-in'}
        </Text>
        {error ? <Banner message={error} /> : <ActivityIndicator size="large" color={colors.accent} />}
        {finished && error ? <Button title="Back to sign in" onPress={() => router.replace('/sign-in')} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text, textAlign: 'center' },
});
