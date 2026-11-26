import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ModeBadge, Screen } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { fonts } from '../lib/fonts';
import { colors, radius, spacing } from '../lib/theme';

const SLIDES = [
  {
    step: '01 / 03',
    title: '3D Printing,\nWithin Reach.',
    body: 'Find a nearby printer, upload a model, and get it made without owning a machine.',
    icon: icons.home,
  },
  {
    step: '02 / 03',
    title: 'Your Ideas.\nMade Real.',
    body: 'Compare local makers by price, distance, and availability before you order.',
    icon: icons.cube,
  },
  {
    step: '03 / 03',
    title: 'Make More\nWith Less.',
    body: 'Connect idle machines with real local maker projects.',
    icon: icons.box,
  },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  const next = () => {
    if (last) router.replace('/sign-in');
    else setIndex((current) => current + 1);
  };

  return (
    <Screen>
      <View style={styles.top}>
        <ModeBadge mode="customer" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          onPress={() => router.replace('/sign-in')}
          hitSlop={spacing.sm}
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.art}>
        <View style={styles.artRing} />
        <View style={styles.artCard}>
          <Icon name={slide.icon} size={72} color={colors.accent} />
        </View>
        <Text style={styles.step}>{slide.step}</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.dots} accessibilityRole="tablist" accessibilityLabel="Onboarding pages">
        {SLIDES.map((item, dotIndex) => (
          <Pressable
            key={item.step}
            accessibilityRole="tab"
            accessibilityLabel={`Page ${dotIndex + 1}`}
            accessibilityState={{ selected: dotIndex === index }}
            onPress={() => setIndex(dotIndex)}
            style={styles.dotTarget}
          >
            <View style={[styles.dot, dotIndex === index && styles.dotActive]} />
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title={last ? 'Get Started' : 'Next'} onPress={next} />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Create an account"
          onPress={() => router.replace('/sign-up')}
          hitSlop={spacing.sm}
          style={styles.createTarget}
        >
          <Text style={styles.create}>Create account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  skip: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  artRing: { position: 'absolute', width: 240, height: 240, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  artCard: {
    width: 156,
    height: 156,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, letterSpacing: 1, color: colors.accent },
  copy: { paddingHorizontal: 24, gap: 12 },
  title: { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 38, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.muted },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 24 },
  dotTarget: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.accent },
  actions: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  createTarget: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  create: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.accent },
});
