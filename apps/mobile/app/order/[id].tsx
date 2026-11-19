import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  ErrorView,
  LoadingView,
  ProgressBar,
  Screen,
  StatusPill,
} from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { ForgeMap } from '../../components/ForgeMap';
import { api } from '../../lib/api';
import { formatMoney, STATUS_LABELS } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, outlined, radius } from '../../lib/theme';
import type { Order, OrderStatus } from '../../lib/types';

const STAGES: OrderStatus[] = ['CONFIRMED', 'IN_QUEUE', 'PRINTING', 'READY_FOR_PICKUP'];

function eventTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`;
}

function remainingLabel(eta: string | null) {
  if (!eta) return '—';
  const date = new Date(eta);
  if (Number.isNaN(date.getTime())) return '—';
  const minutes = Math.max(0, Math.round((date.getTime() - Date.now()) / 60000));
  if (minutes === 0) return 'Any moment';
  if (minutes < 90) return `${minutes} Mins`;
  const hours = Math.round(minutes / 60);
  return `${hours} Hrs`;
}

function pillTone(status: OrderStatus) {
  if (status === 'PRINTING') return 'active' as const;
  if (status === 'READY_FOR_PICKUP') return 'done' as const;
  return 'queued' as const;
}

const STEP_LABELS: Partial<Record<OrderStatus, string>> = {
  IN_QUEUE: 'In Print Queue',
  READY_FOR_PICKUP: 'Ready for Pickup',
};

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      setOrder((await api.getOrder(id)).order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const progress = useMemo(() => {
    if (!order) return 0;
    if (order.status === 'READY_FOR_PICKUP') return 100;
    return Math.max(0, Math.min(100, Math.round(order.progress)));
  }, [order]);

  if (loading) {
    return (
      <Screen>
        <AppHeader back title="Order Tracking" />
        <LoadingView label="Loading order…" />
      </Screen>
    );
  }

  if (error || !order) {
    return (
      <Screen>
        <AppHeader back title="Order Tracking" />
        <ErrorView message={error || 'Order not found'} onRetry={() => void load()} />
      </Screen>
    );
  }

  const currentIndex = STAGES.indexOf(order.status);
  const printer = order.printers;
  const title = printer?.name || `Order #${order.order_number}`;
  const events = order.order_status_events || [];

  const openDirections = () => {
    if (printer && printer.lat && printer.lng) {
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${printer.lat},${printer.lng}`);
    } else if (printer?.location_details) {
      void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(printer.location_details)}`);
    }
  };

  const contactPrinter = () => {
    const phone = printer?.contact_info?.phone;
    const email = printer?.contact_info?.email;
    if (phone) void Linking.openURL(`tel:${phone}`);
    else if (email) void Linking.openURL(`mailto:${email}`);
  };

  return (
    <Screen>
      <AppHeader
        back
        title="Order Tracking"
        right={<StatusPill label={STATUS_LABELS[order.status] ?? order.status} tone={pillTone(order.status)} />}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.orderTop}>
            <Text style={styles.orderNumber}>Order #{order.order_number}</Text>
            <Text style={styles.total}>{formatMoney(order.price_snapshot)}</Text>
          </View>
          <Text style={styles.fileName} numberOfLines={1}>{title}</Text>
          <Text style={styles.meta}>
            {[printer?.name, order.material, order.color, `Qty ${order.quantity}`].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <View style={[styles.card, styles.timelineCard]}>
          {STAGES.map((stage, index) => {
            const event = events.find((item) => item.status === stage);
            const isLast = index === STAGES.length - 1;
            const done = currentIndex > index || order.status === 'READY_FOR_PICKUP';
            const current = currentIndex === index && order.status !== 'READY_FOR_PICKUP';

            let timestamp = 'Not started';
            if (stage === 'CONFIRMED') timestamp = eventTime(event?.created_at ?? order.created_at) ?? 'Not started';
            else if (event) timestamp = eventTime(event.created_at) ?? 'Not started';
            if (stage === 'PRINTING' && current) timestamp = `In progress… ${progress}%`;
            if (stage === 'READY_FOR_PICKUP' && !done) timestamp = 'Waiting for printer';

            return (
              <View key={stage} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]}>
                    {done ? <Icon name={icons.check} size={10} color="#FFFFFF" /> : null}
                  </View>
                  {isLast ? null : <View style={[styles.line, done && styles.lineDone]} />}
                </View>
                <View style={styles.stepBody}>
                  <Text style={[styles.stepTitle, (done || current) && styles.stepTitleActive]}>
                    {STEP_LABELS[stage] ?? STATUS_LABELS[stage]}
                  </Text>
                  <Text style={styles.stepTime}>{timestamp}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Printing Progress</Text>
            <Text style={styles.progressPct}>{progress}%</Text>
          </View>
          <ProgressBar value={progress} height={10} />
          <View style={styles.etaRow}>
            <Text style={styles.eta}>{remainingLabel(order.eta).toLowerCase()}</Text>
            <Text style={styles.etaLabel}>Estimated Time Remaining</Text>
          </View>
        </View>

        <Text style={styles.section}>Pickup</Text>
        <View style={[styles.card, styles.pickupCard]}>
          <View style={styles.pickupIcon}>
            <Icon name={icons.pin} size={18} color={colors.accent} />
          </View>
          <View style={styles.pickupBody}>
            <Text style={styles.pickupName}>{printer?.name ?? 'Your printer'}</Text>
            {printer?.location_details ? <Text style={styles.meta}>{printer.location_details}</Text> : null}
          </View>
          {printer?.distance_km != null ? (
            <Text style={styles.distance}>{Number(printer.distance_km).toFixed(1)} km</Text>
          ) : null}
        </View>

        {printer && Number.isFinite(Number(printer.lat)) && Number.isFinite(Number(printer.lng)) ? (
          <ForgeMap
            height={170}
            zoom={15}
            style={styles.map}
            markers={[
              {
                id: printer.id,
                coords: { lat: Number(printer.lat), lng: Number(printer.lng) },
                title: printer.name,
                subtitle: printer.location_details ?? undefined,
              },
            ]}
            selectedId={printer.id}
          />
        ) : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={openDirections} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Text style={styles.actionLabel}>Get Directions</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={contactPrinter} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Icon name="chatbox-outline" size={15} color={colors.text} />
            <Text style={styles.actionLabelPlain}>Contact Printer</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/orders')} hitSlop={8}>
          <Text style={styles.link}>Back to my orders</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32 },
  pressed: { opacity: 0.85 },

  card: { ...outlined, padding: 16 },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderNumber: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  total: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 17, color: colors.text },
  fileName: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, marginTop: 3 },

  timelineCard: { marginTop: 14, paddingVertical: 8 },
  step: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', width: 20 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotCurrent: { borderColor: colors.accent, borderWidth: 3 },
  line: { flex: 1, width: 2, backgroundColor: colors.hairline, minHeight: 26 },
  lineDone: { backgroundColor: colors.accent },
  stepBody: { flex: 1, paddingVertical: 10, gap: 2 },
  stepTitle: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 19.4, color: colors.muted },
  stepTitleActive: { fontFamily: fonts.semibold, color: colors.text },
  stepTime: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },

  progressCard: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 16, marginTop: 14 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.text },
  progressPct: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  etaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 14 },
  eta: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, color: colors.text },
  etaLabel: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted },

  section: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text, marginTop: 20, marginBottom: 8 },
  pickupCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  pickupIcon: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  pickupBody: { flex: 1 },
  pickupName: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 17, color: colors.text },
  distance: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 14.5, color: colors.muted },

  map: { marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 16 },
  action: {
    flex: 1,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },
  actionLabelPlain: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },

  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link, textAlign: 'center' },
});
