import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, EmptyView, ErrorView, LoadingView, Screen, StatusPill } from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { api } from '../../lib/api';
import { formatDate, STATUS_LABELS } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, radius } from '../../lib/theme';
import type { Order, OrderStatus } from '../../lib/types';

const ACTIVE: OrderStatus[] = ['CONFIRMED', 'IN_QUEUE', 'PRINTING', 'PENDING_ACCEPTANCE'];

function pillTone(status: OrderStatus) {
  if (status === 'PRINTING') return 'active' as const;
  if (status === 'IN_QUEUE' || status === 'PENDING_ACCEPTANCE') return 'queued' as const;
  return 'done' as const;
}

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try { setOrders((await api.getOrders()).orders); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load orders'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) => !ACTIVE.includes(o.status));

  return (
    <Screen>
      <AppHeader />
      {loading && orders.length === 0 ? (
        <LoadingView label="Loading your prints…" />
      ) : error && orders.length === 0 ? (
        <ErrorView message={error} onRetry={() => void load()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
        >
          <Text style={styles.title}>My Orders</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.section}>Active</Text>
          {active.length === 0 ? (
            <EmptyView title="No active orders" message="Upload a model and choose a printer to get started." />
          ) : (
            active.map((order) => <OrderCard key={order.id} order={order} action="Track" onPress={() => router.push(`/order/${order.id}`)} />)
          )}

          <Text style={styles.section}>Past orders</Text>
          {past.length === 0 ? (
            <EmptyView title="No past orders" message="Finished prints will appear here." />
          ) : (
            past.map((order) => <OrderCard key={order.id} order={order} action="Reorder" onPress={() => router.push(`/order/${order.id}`)} />)
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </Screen>
  );
}

function OrderCard({ order, action, onPress }: { order: Order; action: string; onPress: () => void }) {
  const title = order.printers?.name ?? `Order #${order.order_number}`;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardRow}>
        <View style={styles.fileRow}>
          <Icon name={icons.box} size={26} color={colors.text} />
          <Text style={styles.fileName} numberOfLines={1}>{title}</Text>
        </View>
        <StatusPill label={STATUS_LABELS[order.status] ?? order.status} tone={pillTone(order.status)} />
      </View>
      <Text style={styles.details}>
        {[order.printers?.name, order.material, order.color ?? 'Color not set'].filter(Boolean).join(' · ')}
      </Text>
      <View style={styles.cardRow}>
        <Text style={styles.orderNumber}>#{order.order_number} · {formatDate(order.created_at)}</Text>
        <Text style={styles.action}>{action}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 16 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  section: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.danger },
  pressed: { opacity: 0.85 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  fileName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  details: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  orderNumber: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  action: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },
});
