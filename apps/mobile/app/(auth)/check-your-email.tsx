import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Banner, Button, Screen } from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { useAuth } from '../../lib/auth';
import { fonts } from '../../lib/fonts';
import { colors, radius } from '../../lib/theme';

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
          <Icon name={icons.mail} size={30} color={colors.accent} />
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
          <Pressable onPress={() => void resend()} disabled={loading}>
            <Text style={styles.link}>{loading ? 'Sending…' : 'Resend'}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => router.replace('/sign-in')}>
          <Text style={styles.back}>Back to log in</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28, gap: 24, alignItems: 'center' },
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text, textAlign: 'center' },
  description: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23.2, color: colors.muted, textAlign: 'center' },
  action: { alignSelf: 'stretch' },
  resend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prompt: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 19.4, color: colors.muted },
  link: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.link },
  back: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },
});
