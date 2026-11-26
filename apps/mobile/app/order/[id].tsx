import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ModelViewer } from '../../components/ModelViewer';
import { AppHeader, Badge, Button, ErrorView, LoadingView, ProgressBar, Screen, SectionHero, StatusPill, tabularFigures } from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { api } from '../../lib/api';
import { resolveViewerSource } from '../../lib/model-preview';
import { useMarketplaceOrder } from '../../lib/marketplace-hooks';
import type { ModelDetails } from '../../lib/marketplace-types';
import { formatMoney, STATUS_LABELS } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { ORDER_STAGES, PRINT_COMPLETE_STATUSES } from '../../lib/order-status';
import { colors, radius, sectionPalettes, shadow } from '../../lib/theme';

const palette = sectionPalettes.orders;

function etaLabel(eta: string | null) {
  if (!eta) return 'Provider to confirm';
  const date = new Date(eta);
  if (Number.isNaN(date.getTime())) return 'Provider to confirm';
  const minutes = Math.max(0, Math.round((date.getTime() - Date.now()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round(minutes / 60)} hr`;
}

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { order, loading, error, reload } = useMarketplaceOrder(id);
  const [model, setModel] = useState<ModelDetails | null>(null);
  const [modelError, setModelError] = useState('');
  const [viewerInteracting, setViewerInteracting] = useState(false);
  const [pickupBusy, setPickupBusy] = useState(false);
  const [pickupError, setPickupError] = useState('');

  useEffect(() => {
    let active = true;
    if (!order?.modelId) return;
    api.getModel(order.modelId).then((result) => {
      if (active) setModel(result);
    }).catch((err) => {
      if (active) setModelError(err instanceof Error ? err.message : 'Could not load the model preview.');
    });
    return () => { active = false; };
  }, [order?.modelId]);

  if (loading && !order) {
    return <Screen><AppHeader back section="orders" /><LoadingView label="Loading order…" /></Screen>;
  }
  if (error && !order) {
    return <Screen><AppHeader back section="orders" /><ErrorView message={error} onRetry={() => router.replace(`/order/${id}`)} /></Screen>;
  }
  if (!order) return <Screen><AppHeader back section="orders" /><ErrorView message="Order not found." onRetry={() => router.replace('/orders')} /></Screen>;

  const currentIndex = ORDER_STAGES.indexOf(order.status);
  const progress = PRINT_COMPLETE_STATUSES.includes(order.status)
    ? 100
    : Math.max(0, Math.min(100, order.progress));
  const preview = model ? resolveViewerSource(model) : null;
  const confirmPickup = async () => {
    setPickupBusy(true);
    setPickupError('');
    try {
      await api.updateMarketplaceStatus(
        order.id,
        'PICKED_UP',
        'Customer confirmed pickup.',
      );
      reload();
    } catch (err) {
      setPickupError(err instanceof Error ? err.message : 'Could not confirm pickup.');
    } finally {
      setPickupBusy(false);
    }
  };
  const openDirections = () => {
    const destination =
      order.provider?.pickupAddress ??
      order.printers?.name ??
      '3D printing provider';
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
    void Linking.openURL(url);
  };
  const openMessages = () => {
    router.push(`/messages/${order.id}?role=customer`);
  };

  return (
    <Screen>
      <AppHeader back section="orders" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!viewerInteracting}
      >
        <SectionHero
          section="orders"
          title="Order tracking"
          subtitle="Watch your model build from the bottom up."
          action={<Badge label={`${Math.round(progress)}% complete`} accent={palette.accent} />}
        />
        <View style={styles.summary}>
          <Text style={styles.orderNumber}>Order #{order.order_number}</Text>
          <Text style={styles.provider}>{order.printers?.name ?? 'Your provider'}</Text>
          <StatusPill
            label={STATUS_LABELS[order.status] ?? order.status}
            tone={
              order.status === 'DECLINED' || order.status === 'CANCELLED'
                ? 'info'
                : PRINT_COMPLETE_STATUSES.includes(order.status)
                  ? 'done'
                  : 'queued'
            }
          />
          <Text style={styles.meta}>{order.material} · {order.quality} · Qty {order.quantity}</Text>
          <Text style={styles.meta}>Estimate · {formatMoney(order.price_snapshot)}</Text>
          {error ? <Text accessibilityRole="alert" style={styles.pollError}>Could not refresh: {error}</Text> : null}
        </View>

        {preview ? (
          <View style={styles.viewer}>
            <ModelViewer
              url={preview.url}
              format={preview.format}
              progress={progress}
              buildVolume={order.printers?.build_volume ?? undefined}
              onInteractionChange={setViewerInteracting}
            />
          </View>
        ) : null}
        {preview ? <Text style={styles.viewerHint}>Drag to rotate · two fingers to move or zoom</Text> : null}
        {modelError ? <Text accessibilityRole="alert" style={styles.pollError}>{modelError}</Text> : null}

        <View style={styles.timeline}>
          {ORDER_STAGES.map((stage, index) => {
            const done = currentIndex > index;
            const current = currentIndex === index;
            const color = done ? colors.success : current ? colors.printing : colors.queued;
            return (
              <View key={stage} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.dot, { backgroundColor: color }]}>
                    {done ? <Icon name={icons.check} size={13} color={colors.text} /> : null}
                  </View>
                  {index < ORDER_STAGES.length - 1 ? <View style={[styles.line, done && styles.lineDone]} /> : null}
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepTitle, (done || current) && styles.stepTitleActive]}>
                    {STATUS_LABELS[stage]}
                  </Text>
                  {current ? <Text style={styles.stepDetail}>Current status</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Build progress</Text>
            <Text style={styles.progressValue}>{progress}%</Text>
          </View>
          <ProgressBar value={progress} height={12} accent={palette.accent} />
        </View>

        <View style={styles.etaCard}>
          <View style={styles.etaThumb}><Text style={styles.etaValue}>{etaLabel(order.eta)}</Text></View>
          <Text style={styles.etaLabel}>Estimated ready time</Text>
        </View>

        {order.status === 'READY_FOR_PICKUP' ? (
          <View style={styles.pickupCard}>
            <Text style={styles.pickupTitle}>Collect your print</Text>
            <Text style={styles.pickupCopy}>
              Confirm pickup once you have the model. The provider will then close the order.
            </Text>
            {pickupError ? <Text accessibilityRole="alert" style={styles.pollError}>{pickupError}</Text> : null}
            <Button
              title="I picked it up"
              loading={pickupBusy}
              onPress={() => void confirmPickup()}
            />
          </View>
        ) : null}
        {order.status === 'PICKED_UP' ? (
          <View style={styles.pickupCard}>
            <Text style={styles.pickupTitle}>Pickup confirmed</Text>
            <Text style={styles.pickupCopy}>Waiting for the provider to complete the order.</Text>
          </View>
        ) : null}
        {order.status === 'COMPLETED' ? (
          <View style={styles.pickupCard}>
            <Text style={styles.pickupTitle}>Order completed</Text>
            <Text style={styles.pickupCopy}>Thanks for printing with Forge.</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get directions to pickup"
            onPress={openDirections}
            style={styles.action}
          >
            <Icon name={icons.pin} size={20} color={colors.text} />
            <Text style={styles.actionLabel}>Directions</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Contact provider and open messages"
            onPress={openMessages}
            style={styles.action}
          >
            <Icon name={icons.chat} size={20} color={colors.text} />
            <Text style={styles.actionLabel}>Contact &amp; messages</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to my orders"
          onPress={() => router.push('/orders')}
          hitSlop={12}
        >
          <Text style={styles.link}>Back to my orders</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 16 },
  summary: {
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 5,
  },
  orderNumber: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted, ...tabularFigures },
  provider: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.text },
  pollError: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.danger },
  viewer: { height: 320, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bg },
  viewerHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted, textAlign: 'center', marginTop: -8 },
  timeline: { paddingHorizontal: 10, paddingVertical: 8 },
  step: { flexDirection: 'row', gap: 14 },
  rail: { width: 24, alignItems: 'center' },
  dot: { width: 23, height: 23, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 20, marginVertical: 2, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.success },
  stepCopy: { flex: 1, paddingBottom: 18 },
  stepTitle: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20, color: colors.muted },
  stepTitleActive: { fontFamily: fonts.semibold, color: colors.text },
  stepDetail: { marginTop: 3, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.link },
  progressCard: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14, gap: 10 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19.6, color: colors.text },
  progressValue: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text, ...tabularFigures },
  etaCard: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  etaThumb: { minWidth: 88, minHeight: 62, paddingHorizontal: 8, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.raised },
  etaValue: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.text, textAlign: 'center', ...tabularFigures },
  etaLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  pickupCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 8 },
  pickupTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.text },
  pickupCopy: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1, minHeight: 66, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', gap: 5, padding: 8 },
  actionLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.text, textAlign: 'center' },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.link, textAlign: 'center' },
});
