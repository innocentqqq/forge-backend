import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
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
  Banner,
  Button,
  ErrorView,
  LoadingView,
  Screen,
  Toggle,
} from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { formatDate, formatMoney, STATUS_LABELS } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, radius } from '../../lib/theme';
import type { Printer, Quality } from '../../lib/types';
import type { MarketplaceOrder } from '../../lib/marketplace-types';
import type { ProviderProfile } from '../../lib/provider-onboarding';

const QUALITY_LABELS: Record<Quality, string> = {
  DRAFT: '0.2 mm',
  STANDARD: '0.15 mm',
  HIGH: '0.1 mm',
};

function progressForStatus(status: MarketplaceOrder['status']) {
  switch (status) {
    case 'PENDING_ACCEPTANCE':
    case 'CONFIRMED':
    case 'IN_QUEUE':
      return 0;
    case 'PRINTING':
      return 10;
    case 'READY_FOR_PICKUP':
      return 100;
    default:
      return 0;
  }
}

export default function ProviderScreen() {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      let nextProvider: ProviderProfile | null = null;
      try {
        nextProvider = await api.getMyProvider();
      } catch (err) {
        if (!(err instanceof ApiError && err.code === 'PROVIDER_NOT_FOUND')) {
          throw err;
        }
      }
      setProvider(nextProvider);

      if (nextProvider) {
        const [nextOrders, printerResult] = await Promise.all([
          api.getMarketplaceProviderOrders(),
          api.getMyPrinters(),
        ]);
        setOrders(nextOrders);
        setPrinters(printerResult.printers);
      } else {
        setOrders([]);
        setPrinters([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load provider profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openOrder = (order: MarketplaceOrder) => {
    router.push({
      pathname: '/provider-order/[id]' as never,
      params: {
        id: order.id,
        orderNumber: order.order_number,
        title: order.printers?.name ?? 'Print job',
        price: String(order.price_snapshot),
        material: order.material,
        quality: QUALITY_LABELS[order.quality],
        quantity: String(order.quantity),
        status: order.status,
        pickup: provider?.pickupArea ?? order.printers?.location_details ?? 'Pickup details in order',
        progress: String(order.progress ?? progressForStatus(order.status)),
      },
    });
  };

  const updateStatus = async (order: MarketplaceOrder, status: MarketplaceOrder['status']) => {
    setActionError('');
    try {
      await api.updateMarketplaceProgress(order.id, progressForStatus(status), status);
      await load(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the order');
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader back />
        <LoadingView label="Loading provider profile…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppHeader back />
        <ErrorView message={error} onRetry={() => void load()} />
      </Screen>
    );
  }

  if (!provider) {
    return (
      <Screen>
        <AppHeader back />
        <View style={styles.emptyState}>
          <Badge label="Not set up" tone="warning" />
          <Text style={styles.pageTitle}>Become a provider</Text>
          <Text style={styles.intro}>
            Add your pickup area, printers, rates, and pickup hours to start receiving print jobs.
          </Text>
          <Button
            title="Set up provider profile"
            onPress={() => router.push('/provider-onboarding' as never)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <ProviderDashboard
      provider={provider}
      printers={printers}
      orders={orders}
      refreshing={refreshing}
      actionError={actionError}
      onRefresh={() => void load(true)}
      onOpenOrder={openOrder}
      onUpdateStatus={(order, status) => void updateStatus(order, status)}
      onEditSetup={() => router.push('/provider-onboarding' as never)}
      onAvailabilityChange={(isOpen) => {
        setActionError('');
        void api
          .updateMyProvider({ availability: { isOpen } })
          .then(setProvider)
          .catch((err) => {
            setActionError(err instanceof Error ? err.message : 'Could not update availability');
          });
      }}
    />
  );
}

/* ---------------------------------------------------------------- dashboard */

function ProviderDashboard({
  provider,
  printers,
  orders,
  refreshing,
  actionError,
  onRefresh,
  onOpenOrder,
  onUpdateStatus,
  onEditSetup,
  onAvailabilityChange,
}: {
  provider: ProviderProfile;
  printers: Printer[];
  orders: MarketplaceOrder[];
  refreshing: boolean;
  actionError: string;
  onRefresh: () => void;
  onOpenOrder: (order: MarketplaceOrder) => void;
  onUpdateStatus: (order: MarketplaceOrder, status: MarketplaceOrder['status']) => void;
  onEditSetup: () => void;
  onAvailabilityChange: (isOpen: boolean) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    const relevant = orders.filter(
      (order) => order.status !== 'DECLINED' && order.status !== 'CANCELLED',
    );
    const thisMonth = relevant.filter((order) => {
      const created = new Date(order.created_at);
      return (
        created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
      );
    });
    const revenue = thisMonth.reduce((total, order) => total + Number(order.price_snapshot), 0);
    const completed = thisMonth.filter((order) => order.status === 'READY_FOR_PICKUP').length;
    return { revenue, completed };
  }, [orders]);

  const visible = showAll ? orders : orders.slice(0, 2);
  const activePrinters = provider.printers.filter((printer) => printer.isActive).length;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <AppHeader back />
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Provider dashboard</Text>
          <Badge
            label={provider.status === 'active' ? 'Live in search' : provider.status}
            tone={provider.status === 'active' ? 'success' : 'warning'}
          />
        </View>
        <Text style={styles.subtitle}>
          {provider.displayName} · {provider.type === 'LAB' ? 'Lab' : 'Individual maker'} ·{' '}
          {activePrinters} active printer{activePrinters === 1 ? '' : 's'}
        </Text>
        {provider.description ? <Text style={styles.description}>{provider.description}</Text> : null}

        {!provider.setup.canAppearInSearch ? (
          <View style={styles.setupCard}>
            <Banner
              tone="warning"
              message={`Your profile is not in search yet. Complete: ${provider.setup.missing.join(', ')}.`}
            />
            <Button title="Finish setup" variant="secondary" onPress={onEditSetup} />
          </View>
        ) : null}

        <View style={styles.availability}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Accepting new orders</Text>
            <Text style={styles.cardDetail}>Pause to stop receiving jobs</Text>
          </View>
          <Toggle value={provider.availability.isOpen} onValueChange={onAvailabilityChange} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>This month</Text>
            <Text style={styles.statValue}>{formatMoney(stats.revenue)}</Text>
            <Text style={styles.statDetail}>{stats.completed} completed jobs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Turnaround</Text>
            <Text style={styles.statValue}>{provider.turnaroundDays}d</Text>
            <Text style={styles.statDetail}>{provider.maxActiveOrders} max active orders</Text>
          </View>
        </View>

        <Button title="Edit provider profile" variant="secondary" onPress={onEditSetup} />

        <View style={styles.ordersHeader}>
          <Text style={styles.sectionTitle}>Incoming orders</Text>
          <Pressable onPress={() => setShowAll((value) => !value)} hitSlop={8}>
            <Text style={styles.link}>{showAll ? 'Show less' : 'See all'}</Text>
          </Pressable>
        </View>

        {actionError ? <Banner message={actionError} /> : null}

        {orders.length === 0 ? (
          <Text style={styles.empty}>No incoming print requests yet.</Text>
        ) : (
          visible.map((order) => (
            <Pressable
              key={order.id}
              onPress={() => onOpenOrder(order)}
              style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}
            >
              <View style={styles.orderTop}>
                <Text style={styles.orderNumber}>#{order.order_number}</Text>
                <Text style={styles.orderPrice}>{formatMoney(order.price_snapshot)}</Text>
              </View>
              <Text style={styles.orderTitle} numberOfLines={1}>
                {order.printers?.name ?? 'Print job'}
              </Text>
              <Text style={styles.orderMeta}>
                {order.material} · {QUALITY_LABELS[order.quality]} · Qty {order.quantity}
              </Text>
              <Text style={styles.orderMeta}>Placed {formatDate(order.created_at)}</Text>

              <View style={styles.orderActions}>
                {order.status === 'PENDING_ACCEPTANCE' ? (
                  <>
                    <Button
                      title="Decline"
                      variant="secondary"
                      size="sm"
                      labelSize="sm"
                      onPress={() => onUpdateStatus(order, 'DECLINED')}
                      style={styles.declineButton}
                    />
                    <Button
                      title="Accept order"
                      size="sm"
                      labelSize="md"
                      onPress={() => onUpdateStatus(order, 'CONFIRMED')}
                      style={styles.acceptButton}
                    />
                  </>
                ) : order.status === 'CONFIRMED' ? (
                  <Button
                    title="Add to queue"
                    size="sm"
                    labelSize="md"
                    onPress={() => onUpdateStatus(order, 'IN_QUEUE')}
                    style={styles.flex}
                  />
                ) : order.status === 'IN_QUEUE' ? (
                  <Button
                    title="Start printing"
                    size="sm"
                    labelSize="md"
                    onPress={() => onUpdateStatus(order, 'PRINTING')}
                    style={styles.flex}
                  />
                ) : order.status === 'PRINTING' ? (
                  <Button
                    title="Mark ready for pickup"
                    size="sm"
                    labelSize="md"
                    onPress={() => onUpdateStatus(order, 'READY_FOR_PICKUP')}
                    style={styles.flex}
                  />
                ) : (
                  <Text style={styles.orderStatus}>{STATUS_LABELS[order.status]}</Text>
                )}
              </View>
            </Pressable>
          ))
        )}

        {orders.length > 2 ? (
          <Pressable onPress={() => setShowAll((value) => !value)} hitSlop={8}>
            <Text style={styles.viewAll}>{showAll ? 'Show fewer orders' : 'View all orders'}</Text>
          </Pressable>
        ) : null}

        <View style={{ height: 96 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 16 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageTitle: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  emptyState: { flex: 1, justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  description: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },

  setupCard: { gap: 10 },
  availability: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  cardDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 4,
  },
  statLabel: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },
  statValue: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  statDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },

  ordersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },
  empty: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },

  orderCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderNumber: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  orderPrice: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  orderTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  orderMeta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  orderStatus: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },

  orderActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  declineButton: { width: 110, height: 36 },
  acceptButton: { flex: 1, height: 36 },

  viewAll: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link, textAlign: 'center' },
});
