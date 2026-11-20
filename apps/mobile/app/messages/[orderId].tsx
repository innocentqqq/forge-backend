import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { OrderMessages } from '../../components/order-messages';
import { AppHeader, Banner, Button, LoadingView, ScreenScroll } from '../../components/ui';
import { api } from '../../lib/api';
import { fonts } from '../../lib/fonts';
import type { MarketplaceOrder } from '../../lib/marketplace-types';
import type { OrderMessageRole } from '../../lib/types';
import { colors, radius } from '../../lib/theme';

function telUri(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export default function OrderMessagesScreen() {
  const { orderId, role } = useLocalSearchParams<{ orderId: string; role?: string }>();
  const viewerRole: OrderMessageRole = role === 'provider' ? 'PROVIDER' : 'CUSTOMER';
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .getMarketplaceOrder(orderId)
      .then((result) => {
        if (active) setOrder(result);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load the order');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  const contact =
    viewerRole === 'PROVIDER'
      ? {
          name: order?.customer?.fullName ?? 'Customer',
          phone: order?.customer?.phone ?? null,
          detail: 'Customer',
        }
      : {
          name: order?.provider?.displayName ?? 'Service provider',
          phone: order?.provider?.phone ?? null,
          detail: order?.provider?.pickupArea ?? 'Print provider',
        };

  const call = async () => {
    if (!contact.phone) return;
    try {
      await Linking.openURL(telUri(contact.phone));
    } catch {
      Alert.alert('Cannot call', `Your device could not open ${contact.phone}.`);
    }
  };

  if (loading) {
    return (
      <ScreenScroll contentStyle={styles.content}>
        <AppHeader back />
        <LoadingView label="Loading conversation…" />
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll contentStyle={styles.content}>
      <AppHeader back />
      <Text style={styles.title}>Messages</Text>
      <Text style={styles.subtitle}>Order {order?.order_number ?? orderId}</Text>

      {error ? <Banner message={error} /> : null}

      <View style={styles.contactCard}>
        <View style={styles.contactCopy}>
          <Text style={styles.contactDetail}>{contact.detail}</Text>
          <Text style={styles.contactName}>{contact.name}</Text>
          <Text style={styles.contactPhone}>{contact.phone ?? 'No phone number added yet'}</Text>
        </View>
        <Button
          title="Call"
          variant="secondary"
          size="sm"
          disabled={!contact.phone}
          onPress={() => void call()}
        />
      </View>

      <OrderMessages orderId={orderId} viewerRole={viewerRole} />
      <Text style={styles.footnote}>
        Messages are stored with this order so both sides can refer back to pickup details.
      </Text>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 12 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  contactCopy: { flex: 1, gap: 2 },
  contactDetail: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  contactName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  contactPhone: { fontFamily: fonts.regular, fontSize: 13, color: colors.link },
  footnote: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.muted },
});
