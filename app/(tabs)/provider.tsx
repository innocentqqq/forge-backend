import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
  Toggle,
} from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import { formatDate, formatMoney, STATUS_LABELS } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, radius } from '../../lib/theme';
import { MATERIALS, type Material, type Order, type Printer, type Provider } from '../../lib/types';

const LOCATION = { lat: 13.8708, lng: 100.6053 };

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
        latitude: LOCATION.lat,
        longitude: LOCATION.lng,
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
            <Chip label="1 Printer" active onPress={() => undefined} />
            <Chip label="2 Rate" onPress={() => undefined} />
            <Chip label="3 Pickup" onPress={() => undefined} />
          </View>

          <Text style={styles.sectionTitle}>Printer details</Text>
          <View style={styles.card}>
            <FilledField label="Provider name" value={displayName} onChangeText={setDisplayName} placeholder="Krirk University Lab A" />
            <FilledField label="Printer model" value={printerName} onChangeText={setPrinterName} placeholder="Bambu Lab P1S" />
            <FilledField label="Build volume" value={buildVolume} onChangeText={setBuildVolume} placeholder="256 × 256 × 256 mm" />
          </View>

          <Text style={styles.sectionTitle}>Materials</Text>
          <View style={styles.chips}>
            {MATERIALS.map((material) => (
              <Chip
                key={material}
                label={material}
                active={materials.includes(material)}
                onPress={() => toggleMaterial(material)}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Pricing</Text>
          <View style={styles.card}>
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

          <Text style={styles.sectionTitle}>Pickup &amp; availability</Text>
          <View style={styles.card}>
            <FilledField label="Pickup area" value={pickupArea} onChangeText={setPickupArea} placeholder="Bangkok" />
            <FilledField
              label="Pickup address"
              value={pickupAddress}
              onChangeText={setPickupAddress}
              placeholder="Krirk University, Building 4"
            />
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

  return (
    <Screen>
      <AppHeader back />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={styles.pageTitle}>Provider dashboard</Text>
        <Text style={styles.subtitle}>
          {provider.displayName} · {printers.length} printer{printers.length === 1 ? '' : 's'} online
        </Text>

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
            <Text style={styles.statLabel}>Avg. turnaround</Text>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statDetail}>last 30 days</Text>
          </View>
        </View>

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
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 16 },

  pageTitle: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  description: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23.2, color: colors.muted },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  footnote: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted, textAlign: 'center' },

  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

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
