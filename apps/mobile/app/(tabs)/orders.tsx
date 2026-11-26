import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Badge, EmptyView, ErrorView, LoadingView, Screen, SectionHero, StatusPill } from '../../components/ui';
import { useMarketplaceOrders } from '../../lib/marketplace-hooks';
import { formatDate, formatMoney, STATUS_LABELS } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, radius, sectionPalettes } from '../../lib/theme';
import type { OrderStatus } from '../../lib/types';
import type { MarketplaceOrder } from '../../lib/marketplace-types';

const palette = sectionPalettes.orders;

function pillTone(status: OrderStatus) {
  if (status === 'PRINTING') return 'active' as const;
  if (status === 'IN_QUEUE' || status === 'PENDING_ACCEPTANCE') return 'queued' as const;
  return 'done' as const;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { orders, loading, error, reload } = useMarketplaceOrders();

  if (loading && orders.length === 0) {
    return <Screen><AppHeader section="orders" /><LoadingView label="Loading your orders…" /></Screen>;
  }
  if (error && orders.length === 0) {
    return <Screen><AppHeader section="orders" /><ErrorView message={error} onRetry={() => void reload()} /></Screen>;
  }

  const active = orders.filter((order) => !['PICKED_UP', 'COMPLETED', 'DECLINED', 'CANCELLED'].includes(order.status));
  const past = orders.filter((order) => !active.includes(order));

  return (
    <Screen>
      <AppHeader section="orders" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={colors.accent} />}
      >
        <SectionHero
          section="orders"
          title="My orders"
          subtitle="Every print, from queued to ready for pickup."
          action={<Badge label={`${active.length} active`} accent={palette.accent} />}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.section}>Active</Text>
        {active.length === 0 ? (
          <EmptyView title="No active orders" message="Upload a model and choose a provider to get started." />
        ) : (
          active.map((order) => <OrderCard key={order.id} order={order} onPress={() => router.push(`/order/${order.id}`)} />)
        )}
        <Text style={styles.section}>Past orders</Text>
        {past.length === 0 ? (
          <EmptyView title="No past orders" message="Completed prints will appear here." />
        ) : (
          past.map((order) => <OrderCard key={order.id} order={order} onPress={() => router.push(`/order/${order.id}`)} />)
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </Screen>
  );
}

function OrderCard({ order, onPress }: { order: MarketplaceOrder; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <Text style={styles.provider} numberOfLines={1}>{order.printers?.name ?? 'Provider'}</Text>
        <StatusPill label={STATUS_LABELS[order.status] ?? order.status} tone={pillTone(order.status)} />
      </View>
      <Text style={styles.detail}>{order.material} · {order.quality} · Qty {order.quantity}</Text>
      <View style={styles.row}>
        <Text style={styles.detail}>#{order.order_number} · {formatDate(order.created_at)}</Text>
        <Text style={styles.price}>{formatMoney(order.price_snapshot)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 14 },
  section: { fontFamily: fonts.semibold, fontSize: 16, color: palette.ink },
  error: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger },
  card: {
    padding: 14,
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
  },
  pressed: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  provider: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  detail: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  price: { fontFamily: fonts.bold, fontSize: 14, color: palette.accent },
});
