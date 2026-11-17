import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppHeader, HeroTitle, Panel, Screen, Subtitle } from './ui';
import { Icon, icons, type IconName } from './icons';
import { fonts } from '../lib/fonts';
import { colors, radius } from '../lib/theme';

export type OAuthProvider = 'google';

const PROVIDERS: Record<OAuthProvider, { label: string; icon: IconName; iconColor: string }> = {
  google: { label: 'Continue with Google', icon: icons.google, iconColor: '#4285F4' },
};

/** Social sign-in buttons + "or" divider, placed above the email form. */
export function SocialAuthButtons({
  onPress,
  loading,
}: {
  onPress: (provider: OAuthProvider) => void;
  loading?: OAuthProvider | null;
}) {
  return (
    <View style={styles.social}>
      {(Object.keys(PROVIDERS) as OAuthProvider[]).map((provider) => {
        const meta = PROVIDERS[provider];
        const busy = loading === provider;

        return (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityLabel={meta.label}
            disabled={Boolean(loading)}
            onPress={() => onPress(provider)}
            style={({ pressed }) => [
              styles.socialButton,
              pressed && styles.pressed,
              loading && !busy && styles.socialMuted,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.link} />
            ) : (
              <>
                <Icon name={meta.icon} size={20} color={meta.iconColor} />
                <Text style={styles.socialLabel}>{meta.label}</Text>
              </>
            )}
          </Pressable>
        );
      })}
      <View style={styles.orRow}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orLine} />
      </View>
    </View>
  );
}

/**
 * Shared chrome for the authentication screens (Login, Sign Up, Forgot
 * password, Reset password). Matches the "Header / Content / Introduction /
 * Form panel" structure used in the Figma frames.
 */
export function AuthScreen({
  title,
  description,
  children,
  footer,
  terms,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  terms?: string;
}) {
  return (
    <Screen>
      <AppHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <HeroTitle>{title}</HeroTitle>
            <Subtitle>{description}</Subtitle>
          </View>
          <Panel>{children}</Panel>
          {footer}
          {terms ? <Text style={styles.terms}>{terms}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export function AuthFooterLink({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.footer}>
      <Text style={styles.prompt}>{prompt}</Text>
      <Text accessibilityRole="link" onPress={onPress} style={styles.action}>
        {action}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28, gap: 24, flexGrow: 1 },
  intro: { gap: 8 },
  terms: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  prompt: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 19.4, color: colors.muted },
  action: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.link },

  social: { gap: 10 },
  socialButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  socialLabel: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  socialMuted: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },
});
