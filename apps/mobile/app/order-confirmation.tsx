import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, StatusPill } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { fonts } from '../lib/fonts';
import { colors, outlined, radius } from '../lib/theme';

export default function OrderConfirmationScreen() {
  const { orderId, orderNumber, printer, eta } = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
    printer?: string;
    eta?: string;
  }>();
  const router = useRouter();

  return (
    <Screen>
      <AppHeader />
      <View style={styles.content}>
        <View style={styles.mark}>
          <Icon name={icons.check} size={40} color="#FFFFFF" />
        </View>

        <Text style={styles.title}>Order placed!</Text>

        <StatusPill label="Confirmed" tone="done" />

        {orderNumber ? (
          <Text style={styles.body}>
            Order <Text style={styles.bodyStrong}>#{orderNumber}</Text> is queued at {printer || 'your provider'}. We will
            notify you when it is ready for pickup.
          </Text>
        ) : (
          <Text style={styles.body}>Your print is queued. We will notify you when it is ready for pickup.</Text>
        )}

        <View style={styles.etaCard}>
          <Text style={styles.etaLabel}>Estimated ready</Text>
          <Text style={styles.etaValue}>{eta || 'We will confirm shortly'}</Text>
        </View>

        <Button
          style={styles.stretch}
          title="Track order"
          onPress={() => (orderId ? router.replace(`/order/${orderId}`) : router.replace('/orders'))}
        />

        <Pressable onPress={() => router.replace('/')} hitSlop={8}>
          <Text style={styles.link}>Back to home</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  mark: { width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38.7, letterSpacing: -0.6, color: colors.text, textAlign: 'center' },
  body: { maxWidth: 330, fontFamily: fonts.regular, fontSize: 16, lineHeight: 23.2, color: colors.muted, textAlign: 'center' },
  bodyStrong: { fontFamily: fonts.semibold, color: colors.text },
  etaCard: { ...outlined, alignSelf: 'stretch', paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', gap: 4 },
  etaLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  etaValue: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22, color: colors.text, textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },
});
