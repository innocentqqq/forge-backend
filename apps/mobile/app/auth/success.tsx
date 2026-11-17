import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, icons } from '../../components/icons';
import { Button, Screen } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { fonts } from '../../lib/fonts';
import { colors, radius } from '../../lib/theme';

export default function SignUpSuccessScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { method } = useLocalSearchParams<{ method?: string }>();
  const emailConfirmed = method === 'email';

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Icon name={icons.check} size={44} color={colors.accent} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{emailConfirmed ? 'Email confirmed' : 'Sign up successful'}</Text>
          <Text style={styles.body}>
            {emailConfirmed
              ? 'Your email is confirmed and your Forge account is ready.'
              : user?.email
                ? `${user.email} is connected and your Forge account is ready.`
                : 'Your Forge account is ready.'}
          </Text>
          <Text style={styles.hint}>Upload a model, pick a nearby printer, and track every print.</Text>
        </View>

        <Button title="Start printing" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingVertical: 40, justifyContent: 'center', gap: 28 },
  badge: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: 10 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
  },
});
