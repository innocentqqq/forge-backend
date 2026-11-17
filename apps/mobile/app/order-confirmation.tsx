import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen, StatusPill } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { fonts } from '../lib/fonts';
import { colors, radius, shadow } from '../lib/theme';

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
          <Icon name={icons.box} size={26} color={colors.text} />
        </View>

        <Text style={styles.title}>Order placed!</Text>

        <StatusPill label="Confirmed" tone="done" />

        <Text style={styles.body}>
          {orderNumber
            ? `Order #${orderNumber} is queued at ${printer || 'your provider'}. We will notify you when it is ready for pickup.`
            : 'Your print is queued. We will notify you when it is ready for pickup.'}
        </Text>

        <View style={styles.etaCard}>
          <Text style={styles.etaLabel}>Estimated ready</Text>
          <Text style={styles.etaValue}>{eta || 'We will confirm shortly'}</Text>
        </View>

        <Button
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 16,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 38.7,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    maxWidth: 320,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23.2,
    color: colors.muted,
    textAlign: 'center',
  },
  etaCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    ...shadow.card,
  },
  etaLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  etaValue: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },
});
