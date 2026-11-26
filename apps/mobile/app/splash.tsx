import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ModeBadge } from '../components/ui';
import { fonts } from '../lib/fonts';
import { colors, radius } from '../lib/theme';

const logo = require('../assets/forge-logo.png');

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/onboarding' as never), 1800);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.screen}>
      <View style={styles.mode}>
        <ModeBadge mode="customer" />
      </View>
      <View style={styles.center}>
        <View style={styles.logoWell}>
          <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel="Forge logo" />
        </View>
        <Text style={styles.wordmark}>FORGE</Text>
        <Text style={styles.tagline}>Every Printer Has Potential.</Text>
      </View>
      <Text style={styles.footer}>INDUSTRIAL MARKETPLACE · BANGKOK</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16, justifyContent: 'space-between' },
  mode: { alignItems: 'flex-end' },
  center: { alignItems: 'center', gap: 14, marginTop: -40 },
  logoWell: {
    width: 132,
    height: 132,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 90, height: 90 },
  wordmark: { fontFamily: fonts.displayBold, fontSize: 42, lineHeight: 48, letterSpacing: 4, color: colors.text },
  tagline: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.muted },
  footer: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1, color: colors.muted, textAlign: 'center' },
});
