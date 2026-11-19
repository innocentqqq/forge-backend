import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, ErrorView, LoadingView, Screen, StatusPill } from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { api } from '../../lib/api';
import { formatDate, formatMoney, STATUS_LABELS } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, outlined, radius } from '../../lib/theme';
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
  const [tab, setTab] = useState<'active' | 'past'>('active');

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
  const shown = tab === 'active' ? active : past;

  return (
    <Screen>
      <AppHeader />
      <Text style={styles.title}>My Orders</Text>
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
          <View style={styles.tabs}>
            {(['active', 'past'] as const).map((t) => (
              <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={styles.tab}>
                <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t === 'active' ? 'Active' : 'Past orders'}</Text>
                {tab === t ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.list}>
            {shown.length === 0 ? (
              <View style={styles.empty}>
                <Icon name={icons.box} size={28} color={colors.muted} />
                <Text style={styles.emptyText}>{tab === 'active' ? 'No active prints right now.' : 'No past orders yet.'}</Text>
              </View>
            ) : (
              shown.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  action={tab === 'active' ? 'Track' : 'Reorder'}
                  onPress={() => router.push(`/order/${order.id}`)}
                />
              ))
            )}
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>
      )}
    </Screen>
  );
}

function OrderCard({ order, action, onPress }: { order: Order; action: string; onPress: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.fileName} numberOfLines={1}>
          Order #{order.order_number}
        </Text>
        <StatusPill label={STATUS_LABELS[order.status] ?? order.status} tone={pillTone(order.status)} />
      </View>
      <Text style={styles.meta}>
        {[order.printers?.name, order.material, order.color ?? 'Color not set'].filter(Boolean).join(' · ')}
      </Text>
      <Text style={styles.meta}>
        {formatDate(order.created_at)} · {order.quantity} {order.quantity === 1 ? 'pc' : 'pcs'}
      </Text>
      <View style={styles.divider} />
      <View style={styles.bottomRow}>
        <Text style={styles.total}>{formatMoney(Number(order.price_snapshot))}</Text>
        <Pressable hitSlop={8} accessibilityRole="button" onPress={onPress} style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
          <Icon name={icons.chevronRight} size={14} color={colors.accent} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 38.7, letterSpacing: -0.6, color: colors.text, paddingHorizontal: 24, marginTop: 4 },
  content: { paddingHorizontal: 24, paddingBottom: 12 },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.danger, marginTop: 12 },

  tabs: { flexDirection: 'row', gap: 22, borderBottomWidth: 1, borderBottomColor: colors.hairline, marginTop: 12 },
  tab: { paddingTop: 10, gap: 8 },
  tabLabel: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 19.4, color: colors.muted },
  tabLabelActive: { fontFamily: fonts.bold, color: colors.text },
  tabUnderline: { height: 2, borderRadius: 2, backgroundColor: colors.accent },

  list: { marginTop: 16, gap: 12 },
  card: { ...outlined, padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  fileName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 10 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 17, color: colors.text },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.accent },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
});
