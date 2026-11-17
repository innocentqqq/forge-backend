import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  ErrorView,
  LoadingView,
  ProgressBar,
  Screen,
} from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { api } from '../../lib/api';
import { formatMoney, STATUS_LABELS } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, radius, shadow } from '../../lib/theme';
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
        <AppHeader back />
        <LoadingView label="Loading order…" />
      </Screen>
    );
  }

  if (error || !order) {
    return (
      <Screen>
        <AppHeader back />
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
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Order Tracking</Text>

        <View style={styles.summary}>
          <Text style={styles.orderNumber}>Order #{order.order_number}</Text>
          <Text style={styles.objectName} numberOfLines={1}>{title}</Text>
          <Text style={styles.meta}>
            {[printer?.name, order.material, order.color].filter(Boolean).join(' • ')}
          </Text>
          <Text style={styles.meta}>Total {formatMoney(order.price_snapshot)}</Text>
        </View>

        <View style={styles.timeline}>
          {STAGES.map((stage, index) => {
            const event = events.find((item) => item.status === stage);
            const isLast = index === STAGES.length - 1;
            const done = currentIndex > index || (order.status === 'READY_FOR_PICKUP' && index < STAGES.length);
            const current = currentIndex === index && order.status !== 'READY_FOR_PICKUP';
            const printing = stage === 'PRINTING' && current;

            let tone: string = colors.queued;
            if (done) tone = colors.success;
            if (printing) tone = colors.printing;

            let timestamp = 'Not started';
            if (stage === 'CONFIRMED') timestamp = eventTime(event?.created_at ?? order.created_at) ?? 'Not started';
            else if (event) timestamp = eventTime(event.created_at) ?? 'Not started';
            if (printing) timestamp = `Started ${eventTime(event?.created_at) ?? 'now'} · ${progress}%`;

            return (
              <View key={stage} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: tone }]}>
                    {done ? <Icon name={icons.check} size={14} color={colors.text} /> : null}
                    {printing ? <Icon name={icons.printer} size={12} color="#FFFFFF" /> : null}
                  </View>
                  {isLast ? null : (
                    <View style={[styles.line, { backgroundColor: done ? colors.success : colors.border }]} />
                  )}
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepTitle, (done || current) && styles.stepTitleActive]}>
                    {STATUS_LABELS[stage]}
                  </Text>
                  <Text style={styles.stepTime}>{timestamp}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Printing Progress</Text>
            <Text style={styles.progressValue}>{progress}%</Text>
          </View>
          <ProgressBar value={progress} height={14} />
        </View>

        <View style={styles.etaCard}>
          <View style={styles.etaThumb}>
            <Text style={styles.etaMinutes}>{remainingLabel(order.eta)}</Text>
          </View>
          <Text style={styles.etaLabel}>Estimated Time Remaining</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={openDirections}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Icon name={icons.pin} size={20} color={colors.text} />
            <Text style={styles.actionLabel}>Get Directions</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={contactPrinter}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Icon name={icons.phone} size={20} color={colors.text} />
            <Text style={styles.actionLabel}>Contact Printer</Text>
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
  content: { paddingHorizontal: 15, paddingTop: 16, paddingBottom: 32, gap: 16 },
  pressed: { opacity: 0.85 },
  title: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },

  summary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 14,
    gap: 4,
  },
  orderNumber: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.text },
  objectName: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.text },

  timeline: { paddingHorizontal: 10, paddingVertical: 8 },
  step: { flexDirection: 'row', gap: 16 },
  rail: { width: 24, alignItems: 'center' },
  dot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, flex: 1, minHeight: 22, marginVertical: 2 },
  stepCopy: { flex: 1, paddingBottom: 22, gap: 2 },
  stepTitle: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 19.4, color: colors.muted },
  stepTitleActive: { fontFamily: fonts.semibold, color: colors.text },
  stepTime: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },

  progressCard: { backgroundColor: colors.accentSoft, borderRadius: radius.sm, padding: 14, gap: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontFamily: fonts.light, fontSize: 14, lineHeight: 16.9, color: colors.text },
  progressValue: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },

  etaCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  etaThumb: {
    width: 69,
    height: 69,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  etaMinutes: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 24.2, color: colors.text, textAlign: 'center' },
  etaLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },

  actions: { flexDirection: 'row', gap: 14 },
  action: {
    flex: 1,
    minHeight: 71,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  actionLabel: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text, textAlign: 'center' },

  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link, textAlign: 'center' },
});
