import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AppHeader,
  Badge,
  Button,
  EmptyView,
  ErrorView,
  EstimateRow,
  LoadingView,
  ModeBadge,
  Screen,
  SpecLabel,
} from '../components/ui';
import { Icon, icons } from '../components/icons';
import { api } from '../lib/api';
import { formatDate, formatMoney, STATUS_LABELS } from '../lib/format';
import { fonts } from '../lib/fonts';
import { colors, radius } from '../lib/theme';
import type { MarketplaceOrder } from '../lib/marketplace-types';

const CHART = [
  { month: 'JUN', height: 0.42 },
  { month: 'JUL', height: 0.55 },
  { month: 'AUG', height: 0.5 },
  { month: 'SEP', height: 0.72 },
  { month: 'OCT', height: 0.68 },
  { month: 'NOV', height: 1 },
];

export default function ProviderEarningsScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setOrders(await api.getMarketplaceProviderOrders());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load earnings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const summary = useMemo(() => {
    const now = new Date();
    const billable = orders.filter(
      (order) => order.status !== 'DECLINED' && order.status !== 'CANCELLED',
    );
    const thisMonth = billable.filter((order) => {
      const created = new Date(order.created_at);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    });
    const available = billable.filter((order) =>
      ['READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'].includes(order.status),
    );
    const sum = (items: MarketplaceOrder[]) =>
      items.reduce((total, order) => total + Number(order.price_snapshot ?? 0), 0);
    return {
      monthly: sum(thisMonth),
      available: sum(available),
      count: thisMonth.length,
    };
  }, [orders]);

  const payouts = useMemo(
    () => orders.filter((order) =>
      ['READY_FOR_PICKUP', 'PICKED_UP', 'COMPLETED'].includes(order.status),
    ).slice(0, 6),
    [orders],
  );

  const requestPayout = () => {
    Alert.alert(
      'Request payout',
      `${formatMoney(summary.available)} will be queued for review. Payouts are simulated in this demo.`,
      [{ text: 'Done' }],
    );
  };

  return (
    <Screen>
      <AppHeader back section="dashboard" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.modeRow}>
          <ModeBadge mode="provider" />
        </View>

        <View style={styles.intro}>
          <SpecLabel>PROVIDER FINANCES</SpecLabel>
          <Text style={styles.title}>Earnings</Text>
          <Text style={styles.subtitle}>
            {formatMoney(summary.monthly)} this month · {formatMoney(summary.available)} available payout
          </Text>
        </View>

        {error ? (
          <ErrorView title="Could not load earnings" message={error} onRetry={() => void load()} />
        ) : null}

        {loading ? (
          <LoadingView label="Loading earnings…" />
        ) : (
          <>
            <View style={styles.revenueCard}>
              <View style={styles.revenueTop}>
                <SpecLabel>MONTHLY REVENUE</SpecLabel>
                <Badge label="↗ +18.4%" tone="success" />
              </View>
              <Text style={styles.revenueValue}>{formatMoney(summary.monthly)}</Text>
              <Text style={styles.revenueDetail}>{summary.count} billable orders this month</Text>
              <View style={styles.chart}>
                {CHART.map((bar) => (
                  <View key={bar.month} style={styles.chartColumn}>
                    <View style={styles.chartTrack}>
                      <View style={[styles.chartBar, { height: `${bar.height * 100}%` }]} />
                    </View>
                    <Text style={styles.chartLabel}>{bar.month}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.summaryCard}>
              <EstimateRow label="Available payout" value={formatMoney(summary.available)} />
              <EstimateRow label="Pending clearance" value={formatMoney(Math.max(0, summary.monthly - summary.available))} />
              <EstimateRow label="Completed jobs" value={String(orders.filter((order) => order.status === 'COMPLETED').length)} emphasis />
            </View>

            <Button title="Request payout" onPress={requestPayout} disabled={summary.available <= 0} />

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Recent payouts</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to provider dashboard"
                onPress={() => router.replace('/provider' as never)}
                hitSlop={8}
              >
                <Text style={styles.link}>Dashboard</Text>
              </Pressable>
            </View>

            {payouts.length === 0 ? (
              <EmptyView
                title="No payouts yet"
                message="Completed and ready-for-pickup orders will appear here."
                action={<Icon name={icons.card} size={22} color={colors.muted} />}
              />
            ) : (
              payouts.map((order) => (
                <View key={order.id} style={styles.payoutRow}>
                  <View style={styles.payoutIcon}>
                    <Icon name={icons.check} size={16} color={colors.success} />
                  </View>
                  <View style={styles.payoutCopy}>
                    <Text style={styles.payoutTitle}>Order #{order.order_number}</Text>
                    <Text style={styles.payoutMeta}>
                      {STATUS_LABELS[order.status] ?? order.status} · {formatDate(order.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.payoutValue}>{formatMoney(order.price_snapshot)}</Text>
                </View>
              ))
            )}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  modeRow: { alignItems: 'flex-end' },
  intro: { gap: 6 },
  title: { fontFamily: fonts.displayBold, fontSize: 27, lineHeight: 33, color: colors.text },
  subtitle: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, color: colors.muted },

  revenueCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 9,
  },
  revenueTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  revenueValue: { fontFamily: fonts.monoBold, fontSize: 30, lineHeight: 36, color: colors.text },
  revenueDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 8, marginTop: 8 },
  chartColumn: { flex: 1, alignItems: 'center', gap: 6 },
  chartTrack: { width: '100%', height: 84, justifyContent: 'flex-end', borderRadius: radius.xs, backgroundColor: colors.surfaceSubtle },
  chartBar: { width: '100%', borderRadius: radius.xs, backgroundColor: colors.accent },
  chartLabel: { fontFamily: fonts.mono, fontSize: 9, lineHeight: 12, color: colors.muted },

  summaryCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12,
  },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.accent },

  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  payoutIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutCopy: { flex: 1, gap: 3 },
  payoutTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.text },
  payoutMeta: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, color: colors.muted },
  payoutValue: { fontFamily: fonts.monoBold, fontSize: 14, lineHeight: 19, color: colors.text },
});
