import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Banner, Button, ProgressBar, Screen, StatusPill } from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, outlined, radius } from '../../lib/theme';
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
      <AppHeader back title="Update order" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          Order #{params.orderNumber ?? '—'}
          {params.pickup ? ` · ${params.pickup}` : ''}
        </Text>

        <View style={styles.card}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryTitle} numberOfLines={1}>{params.title ?? 'Print job'}</Text>
            <Text style={styles.summaryPrice}>{formatMoney(Number(params.price) || 0)}</Text>
          </View>
          <Text style={styles.meta}>
            {params.material ?? 'PLA'} · {params.quality ?? '0.15 mm'} · Qty {params.quantity ?? '1'}
          </Text>
          <Text style={styles.meta}>Pickup · {params.pickup ?? 'Pickup details in order'}</Text>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Status</Text>
          <StatusPill
            label={STEPS[current] ?? status}
            tone={status === 'PRINTING' ? 'active' : status === 'READY_FOR_PICKUP' ? 'done' : 'queued'}
          />
        </View>
        <View style={styles.card}>
          <View style={styles.progressTop}>
            <Text style={styles.progressLabel}>Job progress</Text>
            <Text style={styles.progressPct}>{progress}%</Text>
          </View>
          <ProgressBar value={progress} />
          <View style={styles.timeline}>
            {STEPS.map((label, index) => {
              const done = current > index || status === 'READY_FOR_PICKUP';
              const active = current === index && status !== 'READY_FOR_PICKUP';
              return (
                <View key={label} style={styles.step}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, done && styles.dotDone, active && styles.dotCurrent]}>
                      {done ? <Icon name={icons.check} size={10} color="#FFFFFF" /> : null}
                    </View>
                    {index < STEPS.length - 1 ? <View style={[styles.line, done && styles.lineDone]} /> : null}
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepLabel, (done || active) && styles.stepLabelActive]}>{label}</Text>
                    <Text style={styles.stepTime}>
                      {done ? 'Completed' : active ? (label === 'Printing' ? `In progress · ${progress}%` : 'In progress') : 'Not started'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {error ? <Banner message={error} /> : null}

        <Button
          title={action ? action.label : 'Order completed'}
          onPress={() => void advance()}
          loading={busy}
          disabled={!action}
          style={styles.cta}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert('Message customer', 'Customer messaging is coming soon.')}
          style={styles.message}
        >
          <Icon name="chatbox-outline" size={16} color={colors.link} />
          <Text style={styles.messageText}>Message customer</Text>
        </Pressable>
        <Text style={styles.note}>Status changes are shared with the customer in real time.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32 },
  lead: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, marginBottom: 14 },

  card: { ...outlined, padding: 16 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  summaryTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  summaryPrice: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, marginTop: 4 },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },

  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  progressPct: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 15.7, color: colors.text },
  timeline: { marginTop: 12 },
  step: { flexDirection: 'row', gap: 14 },
  rail: { alignItems: 'center', width: 20 },
  dot: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  dotCurrent: { borderColor: colors.accent, borderWidth: 3 },
  line: { flex: 1, width: 2, backgroundColor: colors.hairline, minHeight: 24 },
  lineDone: { backgroundColor: colors.accent },
  stepBody: { flex: 1, paddingBottom: 12, gap: 2 },
  stepLabel: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 19.4, color: colors.muted },
  stepLabelActive: { fontFamily: fonts.semibold, color: colors.text },
  stepTime: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },

  cta: { marginTop: 20 },
  message: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  messageText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },
  note: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted, textAlign: 'center', marginTop: 8 },
});
