import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Banner, Button, Screen } from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { useAuth } from '../../lib/auth';
import { fonts } from '../../lib/fonts';
import { colors, radius, touchTarget } from '../../lib/theme';

export default function CheckYourEmailScreen() {
  const { email = '', kind = 'reset' } = useLocalSearchParams<{ email?: string; kind?: string }>();
  const { requestPasswordReset, resendConfirmation } = useAuth();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setLoading(true); setNotice(null); setError(null);
    try {
      if (kind === 'signup') await resendConfirmation(email);
      else await requestPasswordReset(email);
      setNotice('A new email was sent. Use the newest link.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not send the email'); }
    finally { setLoading(false); }
  };

  return (
    <Screen>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.mark}>
          <Icon name={icons.mail} size={20} color={colors.muted} />
        </View>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.description}>
          {kind === 'signup'
            ? `We sent a confirmation link to ${email}. Open it to verify your account.`
            : `We sent a reset link to ${email}. It expires in 30 minutes.`}
        </Text>
        {error ? <Banner message={error} /> : null}
        {notice ? <Banner message={notice} tone="success" /> : null}
        <Button title="Open email app" onPress={() => void Linking.openURL('mailto:')} style={styles.action} />
        <View style={styles.resend}>
          <Text style={styles.prompt}>Didn’t get it?</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resend email"
            accessibilityState={{ disabled: loading, busy: loading }}
            onPress={() => void resend()}
            disabled={loading}
            style={styles.linkTarget}
          >
            <Text style={styles.link}>{loading ? 'Sending…' : 'Resend'}</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to log in"
          onPress={() => router.replace('/sign-in')}
          style={styles.linkTarget}
        >
          <Text style={styles.back}>Back to log in</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28, gap: 24, alignItems: 'center' },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text, textAlign: 'center' },
  description: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23.2, color: colors.muted, textAlign: 'center' },
  action: { alignSelf: 'stretch' },
  resend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prompt: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 19.4, color: colors.muted },
  link: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: colors.link },
  back: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.link },
  linkTarget: { minHeight: touchTarget, justifyContent: 'center' },
});
