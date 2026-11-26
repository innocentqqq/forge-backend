import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  Badge,
  Button,
  EmptyView,
  ErrorView,
  ForgeAvatar,
  LoadingView,
  ModeBadge,
  Screen,
  SettingRow,
  SpecLabel,
} from '../components/ui';
import { icons } from '../components/icons';
import { api, ApiError } from '../lib/api';
import { formatMoney } from '../lib/format';
import { fonts } from '../lib/fonts';
import type { ProviderProfile } from '../lib/provider-onboarding';
import { colors, radius } from '../lib/theme';
import type { MarketplaceOrder } from '../lib/marketplace-types';

export default function ProviderProfileScreen() {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let nextProvider: ProviderProfile | null = null;
      try {
        nextProvider = await api.getMyProvider();
      } catch (err) {
        if (!(err instanceof ApiError && err.code === 'PROVIDER_NOT_FOUND')) throw err;
      }
      setProvider(nextProvider);
      setOrders(nextProvider ? await api.getMarketplaceProviderOrders() : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your provider profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return (
      <Screen>
        <AppHeader back section="shop" />
        <LoadingView label="Loading provider profile…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppHeader back section="shop" />
        <ErrorView message={error} onRetry={() => void load()} />
      </Screen>
    );
  }

  if (!provider) {
    return (
      <Screen>
        <AppHeader back section="shop" />
        <EmptyView
          title="No provider profile"
          message="Register as a provider to see your shop profile."
          action={<Button title="Become a provider" onPress={() => router.push('/provider-onboarding' as never)} />}
        />
      </Screen>
    );
  }

  const activePrinters = provider.printers.filter((printer) => printer.isActive).length;
  const completed = orders.filter((order) => order.status === 'COMPLETED').length;
  const revenue = orders.reduce((total, order) => total + Number(order.price_snapshot ?? 0), 0);
  const initials = provider.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Screen>
      <AppHeader back section="shop" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.modeRow}>
          <ModeBadge mode="provider" />
        </View>

        <View style={styles.identity}>
          <ForgeAvatar initials={initials} size={64} />
          <View style={styles.identityCopy}>
            <Text style={styles.name} numberOfLines={2}>{provider.displayName}</Text>
            <Text style={styles.subtitle}>
              {provider.verification.isVerified ? 'Verified' : 'Unverified'} · {provider.pickupArea} · {activePrinters} printers
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{completed}</Text>
            <Text style={styles.statLabel}>COMPLETED</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{activePrinters}</Text>
            <Text style={styles.statLabel}>PRINTERS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatMoney(revenue)}</Text>
            <Text style={styles.statLabel}>REVENUE</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <SpecLabel>SHOP DETAILS</SpecLabel>
            <Badge label={provider.status === 'active' ? 'LIVE' : provider.status.toUpperCase()} tone="success" />
          </View>
          <SettingRow
            icon={icons.settings}
            title="Shop name & contact"
            detail={provider.contactPhone ?? 'No phone number added'}
            accent={colors.accent}
            onPress={() => router.push('/provider-shop/profile' as never)}
          />
          <SettingRow
            icon={icons.locate}
            title="Pickup area"
            detail={provider.pickupArea}
            accent={colors.accent}
            onPress={() => router.push('/provider-shop/location' as never)}
          />
          <SettingRow
            icon={icons.printer}
            title="Printer management"
            detail={`${activePrinters} active · ${provider.printers.length} total`}
            accent={colors.accent}
            onPress={() => router.push('/provider-shop/printers' as never)}
          />
        </View>

        <View style={styles.sectionCard}>
          <SpecLabel>WORKSPACE</SpecLabel>
          <SettingRow
            icon={icons.briefcase}
            title="Earnings"
            detail="Revenue, payouts, and recent jobs"
            accent={colors.accent}
            onPress={() => router.push('/provider-earnings' as never)}
          />
          <SettingRow
            icon={icons.swap}
            title="Switch to Customer Mode"
            detail="Discover and order prints"
            accent={colors.accent}
            onPress={() => router.replace('/(tabs)' as never)}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open full provider setup"
          onPress={() => router.push('/provider-onboarding' as never)}
          hitSlop={8}
        >
          <Text style={styles.link}>Open full provider setup</Text>
        </Pressable>
        <View style={{ height: 32 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  modeRow: { alignItems: 'flex-end' },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
  },
  identityCopy: { flex: 1, gap: 5 },
  name: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 27, color: colors.text },
  subtitle: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, color: colors.muted },

  statsRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 5,
  },
  statValue: { fontFamily: fonts.monoBold, fontSize: 18, lineHeight: 23, color: colors.text },
  statLabel: { fontFamily: fonts.mono, fontSize: 9, lineHeight: 12, letterSpacing: 0.6, color: colors.muted },

  sectionCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 10,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.accent, textAlign: 'center' },
});
