import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { fonts } from '../lib/fonts';
import { colors, radius } from '../lib/theme';

const FAQS = [
  {
    question: 'How do I upload a file?',
    answer:
      'From Home, tap Upload Your 3D Design and pick an STL, 3MF, or OBJ file. Forge checks the model and takes you straight to print settings.',
  },
  {
    question: 'Which materials can I print?',
    answer:
      'PLA, ABS, PETG, and TPU. Each material has its own price per cm³, and every printer lists the options it supports.',
  },
  {
    question: 'How long does printing take?',
    answer:
      'Most prints finish within a few hours to a day. Each printer shows an estimate, and Order Tracking shows live progress once printing starts.',
  },
  {
    question: 'Where do I pick up my order?',
    answer:
      'Open the order and tap Get Directions. The pickup address and printer contact details are shown on the tracking screen.',
  },
];

export default function HelpScreen() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Screen>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Help &amp; FAQ</Text>

        {FAQS.map((item, index) => {
          const expanded = open === index;
          return (
            <Pressable
              key={item.question}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : index)}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View style={styles.questionRow}>
                <Text style={styles.question}>{item.question}</Text>
                <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
                  <Icon name={icons.chevronRight} size={16} color={colors.muted} />
                </View>
              </View>
              {expanded ? <Text style={styles.answer}>{item.answer}</Text> : null}
            </Pressable>
          );
        })}

        <View style={styles.support}>
          <Text style={styles.supportTitle}>Still need help?</Text>
          <Text style={styles.supportCopy}>Our support team usually replies within a day.</Text>
          <Button
            title="Contact support"
            onPress={() => void Linking.openURL('mailto:support@forge.app?subject=Forge%20support')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 16 },
  pressed: { opacity: 0.85 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },

  item: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  questionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  question: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  answer: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },

  support: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  supportTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  supportCopy: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
});
