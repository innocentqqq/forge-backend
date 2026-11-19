import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AppHeader,
  Banner,
  Button,
  Chip,
  ErrorView,
  FilledField,
  LoadingView,
  Screen,
  StatusPill,
  Toggle,
} from '../../components/ui';
import { ForgeMap } from '../../components/ForgeMap';
import { api, ApiError } from '../../lib/api';
import { DEFAULT_LOCATION, getUserLocation, refreshUserLocation, type LatLng } from '../../lib/location';
import { formatDate, formatMoney, STATUS_LABELS } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, outlined, radius } from '../../lib/theme';
import { MATERIALS, type Material, type Order, type Printer, type Provider } from '../../lib/types';

const QUALITY_LABELS: Record<Order['quality'], string> = {
  DRAFT: '0.2 mm',
  STANDARD: '0.15 mm',
  HIGH: '0.1 mm',
};

function progressForStatus(status: Order['status']) {
  switch (status) {
    case 'CONFIRMED':
    case 'PENDING_ACCEPTANCE':
      return 25;
    case 'IN_QUEUE':
      return 50;
    case 'PRINTING':
      return 60;
    case 'READY_FOR_PICKUP':
      return 100;
    default:
      return 0;
  }
}

function pillTone(status: Order['status']) {
  if (status === 'PRINTING') return 'active' as const;
  if (status === 'READY_FOR_PICKUP') return 'done' as const;
  return 'queued' as const;
}

/** Mean hours from order placed to its READY_FOR_PICKUP event, over the last 30 days. */
function averageTurnaroundHours(orders: Order[]): number | null {
  const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  const spans = orders
    .map((order) => {
      const ready = order.order_status_events?.find((event) => event.status === 'READY_FOR_PICKUP');
      if (!ready) return null;
      const end = Date.parse(ready.created_at);
      const start = Date.parse(order.created_at);
      if (!Number.isFinite(end) || !Number.isFinite(start) || end < cutoff || end < start) return null;
      return (end - start) / 3600000;
    })
    .filter((value): value is number => value !== null);
  if (!spans.length) return null;
  return spans.reduce((sum, value) => sum + value, 0) / spans.length;
}

export default function ProviderScreen() {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      let nextProvider: Provider | null = null;
      try {
        nextProvider = await api.getMyProvider();
      } catch (err) {
        if (!(err instanceof ApiError && err.code === 'PROVIDER_NOT_FOUND')) {
          throw err;
        }
      }
      setProvider(nextProvider);

      if (nextProvider) {
        const [orderResult, printerResult] = await Promise.all([
          api.getProviderOrders().catch(() => ({ orders: [] as Order[] })),
          api.getMyPrinters().catch(() => ({ printers: [] as Printer[] })),
        ]);
        setOrders(orderResult.orders);
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

  const openOrder = (order: Order) => {
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
        pickup: order.printers?.location_details ?? order.printers?.name ?? 'Pickup details in order',
        progress: String(order.progress || progressForStatus(order.status)),
      },
    });
  };

  const updateStatus = async (order: Order, status: string) => {
    setActionError('');
    try {
      await api.updateOrderStatus(order.id, status);
      await load(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the order');
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader back title="Provider dashboard" />
        <LoadingView label="Loading provider profile…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <AppHeader back title="Provider dashboard" />
        <ErrorView message={error} onRetry={() => void load()} />
      </Screen>
    );
  }

  if (!provider) {
    return <ProviderOnboarding onCreated={() => void load()} />;
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
      onUpdateStatus={updateStatus}
      onAvailabilityChange={async (isOpen) => {
        setActionError('');
        try {
          setProvider(await api.updateMyProvider({ availability: { isOpen } }));
        } catch (err) {
          setActionError(err instanceof Error ? err.message : 'Could not update availability');
        }
      }}
    />
  );
}

/* --------------------------------------------------------------- onboarding */

function ProviderOnboarding({ onCreated }: { onCreated: () => void }) {
  const [displayName, setDisplayName] = useState('');
  const [printerName, setPrinterName] = useState('');
  const [buildVolume, setBuildVolume] = useState('256 × 256 × 256');
  const [materials, setMaterials] = useState<Material[]>(['PLA', 'PETG']);
  const [pricePerCm3, setPricePerCm3] = useState('2.50');
  const [minimumOrder, setMinimumOrder] = useState('80');
  const [pickupArea, setPickupArea] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pin, setPin] = useState<LatLng>(DEFAULT_LOCATION);
  const [pinTouched, setPinTouched] = useState(false);
  const [locating, setLocating] = useState(false);

  // Start the pin at the user's position (or the campus fallback) until they move it.
  useEffect(() => {
    let alive = true;
    void getUserLocation().then((loc) => {
      if (alive && !pinTouched) setPin(loc.coords);
    });
    return () => {
      alive = false;
    };
  }, [pinTouched]);

  const movePin = (coords: LatLng) => {
    setPinTouched(true);
    setPin(coords);
  };

  const locateMe = async () => {
    setLocating(true);
    try {
      const loc = await refreshUserLocation();
      if (loc.source === 'fallback') setError('Location permission was not granted — drag the pin to your pickup spot instead.');
      movePin(loc.coords);
    } finally {
      setLocating(false);
    }
  };

  const toggleMaterial = (material: Material) => {
    setMaterials((current) =>
      current.includes(material) ? current.filter((item) => item !== material) : [...current, material],
    );
  };

  const submit = async () => {
    setError('');
    if (!displayName.trim() || !pickupArea.trim() || pickupAddress.trim().length < 5) {
      setError('Add a provider name, pickup area, and a pickup address (5+ characters).');
      return;
    }

    const dimensions = buildVolume
      .split(/[^0-9.]+/)
      .map((part) => Number.parseFloat(part))
      .filter((value) => Number.isFinite(value) && value > 0);
    const [x = 220, y = 220, z = 250] = dimensions;

    setSubmitting(true);
    try {
      await api.onboardProvider({
        type: 'LAB',
        displayName: displayName.trim(),
        bio: null,
        pickupArea: pickupArea.trim(),
        pickupAddress: pickupAddress.trim(),
        latitude: pin.lat,
        longitude: pin.lng,
        availability: { isOpen: true, maxQueueSize: 10 },
        printer: {
          modelName: printerName.trim() || `${displayName.trim()} printer`,
          buildVolume: { x, y, z },
          materials: materials.length ? materials : ['PLA'],
          pricePerCm3: Number.parseFloat(pricePerCm3) || 2.5,
          minimumOrder: Number.parseFloat(minimumOrder) || 80,
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not list your printer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <AppHeader back />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>Become a provider</Text>
          <Text style={styles.description}>
            List a printer, set your rate, and start taking print jobs from makers nearby.
          </Text>

          <View style={styles.steps}>
            {['Printer', 'Rate', 'Pickup'].map((step, index) => (
              <View key={step} style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepLabel}>{step}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeading}>Printer</Text>
            <FilledField label="Provider name" value={displayName} onChangeText={setDisplayName} placeholder="Krirk University Lab A" />
            <FilledField label="Printer model" value={printerName} onChangeText={setPrinterName} placeholder="Bambu Lab P1S" />
            <FilledField label="Build volume" value={buildVolume} onChangeText={setBuildVolume} placeholder="256 × 256 × 256 mm" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeading}>Materials</Text>
            <View style={styles.chips}>
              {MATERIALS.map((material) => (
                <Chip
                  compact
                  key={material}
                  label={material}
                  active={materials.includes(material)}
                  onPress={() => toggleMaterial(material)}
                />
              ))}
            </View>
            <Text style={styles.cardDetail}>{materials.length} selected</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeading}>Pricing</Text>
            <FilledField
              label="Price per cm³"
              value={pricePerCm3}
              onChangeText={setPricePerCm3}
              placeholder="฿2.50"
              keyboardType="decimal-pad"
            />
            <FilledField
              label="Minimum order"
              value={minimumOrder}
              onChangeText={setMinimumOrder}
              placeholder="฿80"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardHeading}>Pickup &amp; availability</Text>
            <FilledField label="Pickup area" value={pickupArea} onChangeText={setPickupArea} placeholder="Bangkok" />
            <FilledField
              label="Pickup address"
              value={pickupAddress}
              onChangeText={setPickupAddress}
              placeholder="Krirk University, Building 4"
            />
            <Text style={styles.pinLabel}>Pickup location</Text>
            <ForgeMap height={200} pick={{ value: pin, onChange: movePin }} />
            <View style={styles.pinRow}>
              <Text style={styles.pinCoords}>
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </Text>
              <Pressable onPress={() => void locateMe()} disabled={locating} hitSlop={8}>
                <Text style={styles.link}>{locating ? 'Locating…' : 'Use my current location'}</Text>
              </Pressable>
            </View>
            <Text style={styles.cardDetail}>
              {Platform.OS === 'web' ? 'Use your current location to set the pin.' : 'Tap the map or drag the pin to where makers collect prints.'}
            </Text>
          </View>

          {error ? <Banner message={error} /> : null}

          <Button title="List my printer" onPress={() => void submit()} loading={submitting} />
          <Text style={styles.footnote}>You can edit these details later from your profile.</Text>
          <View style={{ height: 96 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
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
  onAvailabilityChange,
}: {
  provider: Provider;
  printers: Printer[];
  orders: Order[];
  refreshing: boolean;
  actionError: string;
  onRefresh: () => void;
  onOpenOrder: (order: Order) => void;
  onUpdateStatus: (order: Order, status: string) => void;
  onAvailabilityChange: (isOpen: boolean) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    const relevant = orders.filter((order) => order.status !== 'DECLINED' && order.status !== 'CANCELLED');
    const thisMonth = relevant.filter((order) => {
      const created = new Date(order.created_at);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    });
    const revenue = thisMonth.reduce((total, order) => total + Number(order.price_snapshot), 0);
    const completed = thisMonth.filter((order) => order.status === 'READY_FOR_PICKUP').length;
    return { revenue, completed };
  }, [orders]);

  const visible = showAll ? orders : orders.slice(0, 2);
  const turnaround = useMemo(() => averageTurnaroundHours(orders), [orders]);
  const isOpen = provider.availability.isOpen;

  return (
    <Screen>
      <AppHeader back title="Provider dashboard" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={styles.subtitle}>
          {provider.displayName} · {printers.length} printer{printers.length === 1 ? '' : 's'} online
        </Text>

        <View style={styles.availability}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{isOpen ? 'Accepting new orders' : 'Paused'}</Text>
            <Text style={styles.cardDetail}>{isOpen ? 'Pause to stop receiving jobs' : 'Turn on to receive new print jobs'}</Text>
          </View>
          <Toggle value={isOpen} onValueChange={onAvailabilityChange} />
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statHalf}>
            <Text style={styles.statLabel}>This month</Text>
            <Text style={styles.statValue}>{formatMoney(stats.revenue)}</Text>
            <Text style={styles.statDetail}>{stats.completed} completed jobs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statHalf}>
            <Text style={styles.statLabel}>Avg. turnaround</Text>
            <Text style={styles.statValue}>{turnaround === null ? '—' : `${Math.round(turnaround)} hrs`}</Text>
            <Text style={styles.statDetail}>last 30 days</Text>
          </View>
        </View>

        {!isOpen ? (
          <View style={styles.pausedNote}>
            <Text style={styles.pausedText}>Paused — existing jobs stay visible, new jobs are on hold.</Text>
          </View>
        ) : null}

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
              <StatusPill label={STATUS_LABELS[order.status] ?? order.status} tone={pillTone(order.status)} />

              <View style={styles.orderActions}>
                {order.status === 'CONFIRMED' || order.status === 'PENDING_ACCEPTANCE' ? (
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
                      onPress={() => onUpdateStatus(order, 'IN_QUEUE')}
                      style={styles.acceptButton}
                    />
                  </>
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
  content: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 24, gap: 14 },

  pageTitle: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.4, color: colors.text, marginTop: 8 },
  description: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23.2, color: colors.muted },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  footnote: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted, textAlign: 'center' },

  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepNumber: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 13.3, color: '#FFFFFF' },
  stepLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.text },

  card: { ...outlined, padding: 16, gap: 10 },
  cardHeading: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 18, color: colors.text },
  pinLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.text, marginTop: 4 },
  pinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pinCoords: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  availability: { ...outlined, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 18, color: colors.text },
  cardDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted, marginTop: 2 },

  statsCard: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 16, flexDirection: 'row', gap: 14 },
  statHalf: { flex: 1, gap: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(16,19,26,0.12)' },
  statLabel: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.text, opacity: 0.75 },
  statValue: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, color: colors.text },
  statDetail: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.text, opacity: 0.75 },
  pausedNote: { backgroundColor: colors.surfaceSubtle, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 },
  pausedText: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted },

  ordersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },
  empty: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },

  orderCard: { ...outlined, padding: 14, gap: 4 },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderNumber: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 14.5, color: colors.muted },
  orderPrice: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  orderTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text, marginTop: 2 },
  orderMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted, marginBottom: 4 },
  orderStatus: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },

  orderActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  declineButton: { width: 110, height: 36 },
  acceptButton: { flex: 1, height: 36 },

  viewAll: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link, textAlign: 'center' },
});
