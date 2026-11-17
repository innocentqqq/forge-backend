import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Banner, Button, ProgressBar, Screen } from '../../components/ui';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, radius } from '../../lib/theme';
import type { OrderStatus } from '../../lib/types';

const STEPS = ['Confirmed', 'In queue', 'Printing', 'Ready for pickup'];

function stageIndex(status: OrderStatus) {
  switch (status) {
    case 'CONFIRMED':
    case 'PENDING_ACCEPTANCE':
      return 0;
    case 'IN_QUEUE':
      return 1;
    case 'PRINTING':
      return 2;
    case 'READY_FOR_PICKUP':
      return 3;
    default:
      return -1;
  }
}

function nextAction(status: OrderStatus): { label: string; next: OrderStatus } | null {
  switch (status) {
    case 'CONFIRMED':
    case 'PENDING_ACCEPTANCE':
      return { label: 'Accept order', next: 'IN_QUEUE' };
    case 'IN_QUEUE':
      return { label: 'Start printing', next: 'PRINTING' };
    case 'PRINTING':
      return { label: 'Mark ready for pickup', next: 'READY_FOR_PICKUP' };
    default:
      return null;
  }
}

export default function ProviderOrderScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    orderNumber?: string;
    title?: string;
    price?: string;
    material?: string;
    quality?: string;
    quantity?: string;
    status?: string;
    pickup?: string;
    progress?: string;
  }>();
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>((params.status as OrderStatus) || 'CONFIRMED');
  const [progress, setProgress] = useState(Number(params.progress) || 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const current = stageIndex(status);
  const action = nextAction(status);

  const advance = async () => {
    if (!params.id || !action) return;
    setBusy(true);
    setError('');
    try {
      await api.updateOrderStatus(params.id, action.next);
      setStatus(action.next);
      setProgress(action.next === 'READY_FOR_PICKUP' ? 100 : action.next === 'PRINTING' ? 60 : action.next === 'IN_QUEUE' ? 50 : 25);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the order');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Update order</Text>
        <Text style={styles.subtitle}>Order #{params.orderNumber ?? '—'}</Text>

        <View style={styles.card}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryTitle} numberOfLines={1}>{params.title ?? 'Print job'}</Text>
            <Text style={styles.summaryPrice}>{formatMoney(Number(params.price) || 0)}</Text>
          </View>
          <Text style={styles.meta}>
            {params.material ?? 'PLA'} · {params.quality ?? '0.15 mm'} · Qty {params.quantity ?? '1'}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.meta}>Pickup · {params.pickup ?? 'Pickup details in order'}</Text>
        </View>

        <View style={styles.statusHeader}>
          <Text style={styles.sectionTitle}>Status</Text>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
        <ProgressBar value={progress} height={6} />

        <View style={styles.timeline}>
          {STEPS.map((label, index) => {
            const done = current > index;
            const active = current === index;
            return (
              <View key={label} style={styles.step}>
                <View style={styles.rail}>
                  <View
                    style={[
                      styles.dot,
                      done && styles.dotDone,
                      active && styles.dotActive,
                      !done && !active && styles.dotPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dotLabel,
                        done && styles.dotLabelDone,
                        active && styles.dotLabelActive,
                        !done && !active && styles.dotLabelPending,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  {index < STEPS.length - 1 ? <View style={styles.connector} /> : null}
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepTitle, (done || active) && styles.stepTitleActive]}>{label}</Text>
                  <Text style={styles.stepDetail}>
                    {done ? 'Completed' : active ? 'In progress' : 'Not started'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {error ? <Banner message={error} /> : null}

        <Button
          title={action ? action.label : 'Order completed'}
          onPress={() => void advance()}
          loading={busy}
          disabled={!action}
        />

        <Pressable
          onPress={() => Alert.alert('Message customer', 'Customer messaging is coming soon.')}
          hitSlop={8}
        >
          <Text style={styles.link}>Message customer</Text>
        </Pressable>
        <Text style={styles.footnote}>Status changes are shared with the customer in real time.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 16 },
  pageTitle: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  progressValue: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  summaryPrice: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6 },

  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  timeline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
  },
  step: { flexDirection: 'row', gap: 12 },
  rail: { width: 24, alignItems: 'center' },
  dot: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.accent },
  dotActive: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.accent },
  dotPending: { backgroundColor: colors.surfaceSubtle, borderWidth: 1, borderColor: colors.border },
  dotLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7 },
  dotLabelDone: { color: '#FFFFFF' },
  dotLabelActive: { color: colors.accent },
  dotLabelPending: { color: colors.muted },
  connector: { width: 2, flex: 1, minHeight: 34, backgroundColor: colors.border },
  stepCopy: { flex: 1, paddingBottom: 18, gap: 2 },
  stepTitle: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23.2, color: colors.muted },
  stepTitleActive: { color: colors.text },
  stepDetail: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },

  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link, textAlign: 'center' },
  footnote: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted, textAlign: 'center' },
});
