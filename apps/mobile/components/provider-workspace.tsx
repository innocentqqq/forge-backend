import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  EmptyView,
  ErrorView,
  LoadingView,
  Screen,
  SectionHero,
  SectionTitle,
  SettingRow,
  Toggle,
  tabularFigures,
} from './ui';
import { Icon, icons } from './icons';
import { api, ApiError } from '../lib/api';
import { formatDate, formatMoney, STATUS_LABELS } from '../lib/format';
import { fonts } from '../lib/fonts';
import { progressForStatus } from '../lib/order-status';
import {
  colors,
  radius,
  sectionPalettes,
  touchTarget,
  type AppSection,
  type SectionPalette,
} from '../lib/theme';
import type { Quality } from '../lib/types';
import type { MarketplaceOrder } from '../lib/marketplace-types';
import { DAY_LABELS, PICKUP_DAYS, type ProviderProfile } from '../lib/provider-onboarding';
import type { ProviderShopSection } from './provider-shop-editor';

export type ProviderSection = 'dashboard' | 'orders' | 'settings';

const QUALITY_LABELS: Record<Quality, string> = {
  DRAFT: '0.2 mm',
  STANDARD: '0.15 mm',
  HIGH: '0.1 mm',
};

const SECTION_TITLES: Record<ProviderSection, string> = {
  dashboard: 'Dashboard',
  orders: 'Print jobs',
  settings: 'Shop settings',
};

const SECTION_PALETTES: Record<ProviderSection, AppSection> = {
  dashboard: 'dashboard',
  orders: 'jobs',
  settings: 'shop',
};

type OrderFilter = 'all' | 'pending' | 'active' | 'done';

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Needs action' },
  { key: 'active', label: 'In progress' },
  { key: 'done', label: 'Finished' },
];

function statusLabel(provider: ProviderProfile) {
  if (!provider.availability.isOpen) return 'Paused';
  if (provider.status === 'active') return 'Live in search';
  return provider.status;
}

function statusTone(provider: ProviderProfile): 'success' | 'warning' {
  return provider.status === 'active' && provider.availability.isOpen ? 'success' : 'warning';
}

function hoursSummary(hours: ProviderProfile['hours']): string {
  const open = PICKUP_DAYS.filter((day) => hours[day]);
  if (open.length === 0) return 'No pickup days set';
  if (open.length === PICKUP_DAYS.length) return 'Open every day';
  if (
    open.length === 5 &&
    PICKUP_DAYS.slice(0, 5).every((day) => Boolean(hours[day]))
  ) {
    return 'Weekdays';
  }
  return open.map((day) => DAY_LABELS[day].slice(0, 3)).join(', ');
}

export function ProviderHeader({
  title,
  section = 'dashboard',
}: {
  title: string;
  section?: ProviderSection;
}) {
  const router = useRouter();
  const palette = sectionPalettes[SECTION_PALETTES[section]];
  return (
    <View style={[styles.header, { backgroundColor: palette.ink }]}>
      <View style={styles.headerIdentity}>
        <Text style={[styles.headerBrand, { color: palette.soft }]}>FORGE PROVIDER</Text>
        <Text style={[styles.headerTitle, { color: colors.secondary }]}>{title}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch to customer mode"
        onPress={() => router.replace('/(tabs)' as never)}
        style={({ pressed }) => [
          styles.modeButton,
          { backgroundColor: palette.accent },
          pressed && styles.pressed,
        ]}
      >
        <Icon name={icons.swap} size={16} color={colors.secondary} />
        <Text style={styles.modeButtonText}>Customer mode</Text>
      </Pressable>
    </View>
  );
}

export default function ProviderWorkspace({ section }: { section: ProviderSection }) {
  const router = useRouter();
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      let nextProvider: ProviderProfile | null = null;
      try {
        nextProvider = await api.getMyProvider();
      } catch (err) {
        if (!(err instanceof ApiError && err.code === 'PROVIDER_NOT_FOUND')) {
          throw err;
        }
      }
      setProvider(nextProvider);

      if (nextProvider) {
        setOrders(await api.getMarketplaceProviderOrders());
      } else {
        setOrders([]);
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

  const openOrder = (order: MarketplaceOrder) => {
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
        pickup: provider?.pickupArea ?? order.printers?.location_details ?? 'Pickup details in order',
        progress: String(order.progress ?? progressForStatus(order.status)),
      },
    });
  };

  const updateStatus = async (order: MarketplaceOrder, status: MarketplaceOrder['status']) => {
    setActionError('');
    try {
      await api.updateMarketplaceProgress(order.id, progressForStatus(status), status);
      await load(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update the order');
    }
  };

  const updateAvailability = async (isOpen: boolean) => {
    setActionError('');
    try {
      setProvider(await api.updateMyProvider({ availability: { isOpen } }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update availability');
    }
  };

  const openQuickEdit = (section: ProviderShopSection) => {
    setActionError('');
    router.push(`/provider-shop/${section}` as never);
  };

  const palette = sectionPalettes[SECTION_PALETTES[section]];

  if (loading) {
    return (
      <Screen style={styles.screen}>
        <ProviderHeader title={SECTION_TITLES[section]} section={section} />
        <LoadingView label="Loading your shop…" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.screen}>
        <ProviderHeader title={SECTION_TITLES[section]} section={section} />
        <ErrorView message={error} onRetry={() => void load()} />
      </Screen>
    );
  }

  if (!provider) {
    return (
      <Screen style={styles.screen}>
        <ProviderHeader title="Provider setup" section={section} />
        <View style={styles.emptyState}>
          <Badge label="Not set up" tone="warning" />
          <Text style={styles.pageTitle}>Become a provider</Text>
          <Text style={styles.intro}>
            Add your pickup area, printers, rates, and pickup hours to start receiving print jobs.
          </Text>
          <Button
            title="Set up provider profile"
            onPress={() => router.push('/provider-onboarding' as never)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />
        }
      >
        <ProviderHeader title={SECTION_TITLES[section]} section={section} />

        <SectionHero
          section={SECTION_PALETTES[section]}
          title={SECTION_TITLES[section]}
          subtitle={`${provider.displayName} · ${provider.type === 'LAB' ? 'Lab' : 'Individual maker'}`}
          action={
            <Badge
              label={statusLabel(provider)}
              tone={statusTone(provider)}
              accent={palette.accent}
            />
          }
        />

        {!provider.setup.canAppearInSearch ? (
          <Banner
            tone="warning"
            message={`Your shop is hidden from search. Complete: ${provider.setup.missing.join(', ')}.`}
          />
        ) : null}
        {actionError ? <Banner message={actionError} /> : null}

        {section === 'dashboard' ? (
          <DashboardSection
            provider={provider}
            orders={orders}
            palette={palette}
            onOpenOrder={openOrder}
            onUpdateStatus={(order, status) => void updateStatus(order, status)}
            onEditSetup={() => router.push('/provider-onboarding' as never)}
            onQuickEdit={openQuickEdit}
            onAvailabilityChange={(isOpen) => void updateAvailability(isOpen)}
          />
        ) : null}
        {section === 'orders' ? (
          <OrdersSection
            orders={orders}
            palette={palette}
            onOpenOrder={openOrder}
            onUpdateStatus={(order, status) => void updateStatus(order, status)}
          />
        ) : null}
        {section === 'settings' ? (
          <SettingsSection
            provider={provider}
            palette={palette}
            onEditSetup={() => router.push('/provider-onboarding' as never)}
            onQuickEdit={openQuickEdit}
            onAvailabilityChange={(isOpen) => void updateAvailability(isOpen)}
          />
        ) : null}

        <View style={{ height: 112 }} />
      </ScrollView>
    </Screen>
  );
}

/* ---------------------------------------------------------------- dashboard */

function DashboardSection({
  provider,
  orders,
  palette,
  onOpenOrder,
  onUpdateStatus,
  onEditSetup,
  onQuickEdit,
  onAvailabilityChange,
}: {
  provider: ProviderProfile;
  orders: MarketplaceOrder[];
  palette: SectionPalette;
  onOpenOrder: (order: MarketplaceOrder) => void;
  onUpdateStatus: (order: MarketplaceOrder, status: MarketplaceOrder['status']) => void;
  onEditSetup: () => void;
  onQuickEdit: (section: ProviderShopSection) => void;
  onAvailabilityChange: (isOpen: boolean) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const stats = useMemo(() => {
    const now = new Date();
    const relevant = orders.filter(
      (order) => order.status !== 'DECLINED' && order.status !== 'CANCELLED',
    );
    const thisMonth = relevant.filter((order) => {
      const created = new Date(order.created_at);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    });
    const revenue = thisMonth.reduce((total, order) => total + Number(order.price_snapshot), 0);
    const completed = thisMonth.filter((order) => order.status === 'COMPLETED').length;
    return { revenue, completed };
  }, [orders]);

  const activePrinters = provider.printers.filter((printer) => printer.isActive).length;

  return (
    <View style={styles.sectionGap}>
      <View style={styles.availability}>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>Accepting new orders</Text>
          <Text style={styles.cardDetail}>Pause to stop receiving jobs</Text>
        </View>
        <Toggle
          value={provider.availability.isOpen}
          onValueChange={onAvailabilityChange}
          accessibilityLabel="Accepting new orders"
        />
      </View>

      <View style={styles.statsRow}>
        <Card accent={palette.accent} style={{ backgroundColor: palette.surface }}>
          <Text style={styles.statLabel}>This month</Text>
          <Text style={styles.statValue}>{formatMoney(stats.revenue)}</Text>
          <Text style={styles.statDetail}>{stats.completed} completed jobs</Text>
        </Card>
        <Card accent={palette.accent} style={{ backgroundColor: palette.surface }}>
          <Text style={styles.statLabel}>Turnaround</Text>
          <Text style={styles.statValue}>{provider.turnaroundDays}d</Text>
          <Text style={styles.statDetail}>{provider.maxActiveOrders} max active orders</Text>
        </Card>
      </View>

      <Card accent={palette.accent} style={{ backgroundColor: palette.surface }}>
        <Text style={styles.cardTitle}>Your shop</Text>
        <Text style={styles.cardDetail}>
          {activePrinters} active printer{activePrinters === 1 ? '' : 's'} ·{' '}
          {provider.pickupArea || 'Pickup area not set'}
        </Text>
        <Button
          title="Quick edit printers"
          variant="secondary"
          onPress={() => onQuickEdit('printers')}
        />
        <Button
          title="Change open days"
          variant="secondary"
          onPress={() => onQuickEdit('hours')}
        />
        <Button title="Full provider setup" variant="ghost" onPress={onEditSetup} />
      </Card>

      <View style={styles.ordersHeader}>
        <Text style={styles.sectionTitle}>Recent jobs</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showAll ? 'Show fewer jobs' : 'Show all jobs'}
          accessibilityState={{ expanded: showAll }}
          onPress={() => setShowAll((value) => !value)}
          hitSlop={12}
        >
          <Text style={styles.link}>{showAll ? 'Show less' : 'See all'}</Text>
        </Pressable>
      </View>

      {orders.length === 0 ? (
        <EmptyView
          title="No jobs yet"
          message="New print requests will appear here as customers place orders."
        />
      ) : (
        (showAll ? orders : orders.slice(0, 3)).map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onOpen={onOpenOrder}
            onUpdateStatus={onUpdateStatus}
          />
        ))
      )}
    </View>
  );
}

/* -------------------------------------------------------------------- jobs */

function OrdersSection({
  orders,
  palette,
  onOpenOrder,
  onUpdateStatus,
}: {
  orders: MarketplaceOrder[];
  palette: SectionPalette;
  onOpenOrder: (order: MarketplaceOrder) => void;
  onUpdateStatus: (order: MarketplaceOrder, status: MarketplaceOrder['status']) => void;
}) {
  const [filter, setFilter] = useState<OrderFilter>('all');

  const filtered = useMemo(() => {
    switch (filter) {
      case 'pending':
        return orders.filter((order) => order.status === 'PENDING_ACCEPTANCE');
      case 'active':
        return orders.filter((order) =>
          ['CONFIRMED', 'IN_QUEUE', 'PRINTING'].includes(order.status),
        );
      case 'done':
        return orders.filter((order) =>
          ['PICKED_UP', 'COMPLETED', 'DECLINED', 'CANCELLED'].includes(order.status),
        );
      default:
        return orders;
    }
  }, [filter, orders]);

  return (
    <View style={styles.sectionGap}>
      <View style={styles.chipRow}>
        {FILTERS.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            active={filter === option.key}
            onPress={() => setFilter(option.key)}
          />
        ))}
      </View>

      {filtered.length === 0 ? (
        <Card accent={palette.accent} style={{ backgroundColor: palette.surface }}>
          <Text style={styles.cardTitle}>Nothing here yet</Text>
          <Text style={styles.cardDetail}>
            {filter === 'all'
              ? 'New print requests will appear here.'
              : 'No jobs match this filter.'}
          </Text>
        </Card>
      ) : (
        filtered.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onOpen={onOpenOrder}
            onUpdateStatus={onUpdateStatus}
          />
        ))
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ order */

function OrderCard({
  order,
  onOpen,
  onUpdateStatus,
}: {
  order: MarketplaceOrder;
  onOpen: (order: MarketplaceOrder) => void;
  onUpdateStatus: (order: MarketplaceOrder, status: MarketplaceOrder['status']) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.order_number}, ${STATUS_LABELS[order.status] ?? order.status}, ${formatMoney(order.price_snapshot)}`}
      onPress={() => onOpen(order)}
      style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}
    >
      <View style={styles.orderTop}>
        <Text style={styles.orderNumber}>#{order.order_number}</Text>
        <Text style={styles.orderPrice}>{formatMoney(order.price_snapshot)}</Text>
      </View>
      <Text style={styles.orderTitle} numberOfLines={2}>
        {order.printers?.name ?? 'Print job'}
      </Text>
      <Text style={styles.orderMeta}>
        {order.material} · {QUALITY_LABELS[order.quality]} · Qty {order.quantity}
      </Text>
      <Text style={styles.orderMeta}>Placed {formatDate(order.created_at)}</Text>
      <Badge label={STATUS_LABELS[order.status]} tone="info" />

      <View style={styles.orderActions}>
        {order.status === 'PENDING_ACCEPTANCE' ? (
          <>
            <Button
              title="Decline"
              variant="secondary"
              size="sm"
              labelSize="sm"
              onPress={() =>
                Alert.alert(
                  'Decline this order?',
                  `Order #${order.order_number} will be closed and the customer will be told it was declined.`,
                  [
                    { text: 'Keep order', style: 'cancel' },
                    {
                      text: 'Decline',
                      style: 'destructive',
                      onPress: () => onUpdateStatus(order, 'DECLINED'),
                    },
                  ],
                )
              }
              style={styles.declineButton}
            />
            <Button
              title="Accept order"
              size="sm"
              labelSize="md"
              onPress={() => onUpdateStatus(order, 'CONFIRMED')}
              style={styles.acceptButton}
            />
          </>
        ) : order.status === 'CONFIRMED' ? (
          <Button
            title="Add to queue"
            size="sm"
            labelSize="md"
            onPress={() => onUpdateStatus(order, 'IN_QUEUE')}
            style={styles.flex}
          />
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
        ) : order.status === 'PICKED_UP' ? (
          <Button
            title="Complete order"
            size="sm"
            labelSize="md"
            onPress={() => onUpdateStatus(order, 'COMPLETED')}
            style={styles.flex}
          />
        ) : (
          <Text style={styles.orderStatus}>{STATUS_LABELS[order.status]}</Text>
        )}
      </View>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- settings */

function SettingsSection({
  provider,
  palette,
  onEditSetup,
  onQuickEdit,
  onAvailabilityChange,
}: {
  provider: ProviderProfile;
  palette: SectionPalette;
  onEditSetup: () => void;
  onQuickEdit: (section: ProviderShopSection) => void;
  onAvailabilityChange: (isOpen: boolean) => void;
}) {
  const activePrinters = provider.printers.filter((printer) => printer.isActive).length;

  return (
    <View style={styles.sectionGap}>
      <Card accent={palette.accent} style={{ backgroundColor: palette.surface }}>
        <Text style={styles.cardTitle}>Quick edits</Text>
        <Text style={styles.cardDetail}>
          Change the things you use most without running the full setup again.
        </Text>
        <SettingRow
          icon={icons.settings}
          title="Shop details & phone"
          detail={`${provider.displayName} · ${provider.contactPhone || 'No phone'}`}
          accent={palette.accent}
          onPress={() => onQuickEdit('profile')}
        />
        <SettingRow
          icon={icons.locate}
          title="Pickup location"
          detail={provider.pickupArea || 'Not set'}
          accent={palette.accent}
          onPress={() => onQuickEdit('location')}
        />
        <SettingRow
          icon={icons.clock}
          title="Open days & hours"
          detail={hoursSummary(provider.hours)}
          accent={palette.accent}
          onPress={() => onQuickEdit('hours')}
        />
        <SettingRow
          icon={icons.printer}
          title="Printers"
          detail={`${activePrinters} active · ${provider.printers.length} total`}
          accent={palette.accent}
          onPress={() => onQuickEdit('printers')}
        />
      </Card>

      <Card accent={palette.accent} style={{ backgroundColor: palette.surface }}>
        <View style={styles.toggleRow}>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Accepting new orders</Text>
            <Text style={styles.cardDetail}>Turn this off to pause incoming jobs.</Text>
          </View>
          <Toggle
            value={provider.availability.isOpen}
            onValueChange={onAvailabilityChange}
            accessibilityLabel="Accepting new orders"
          />
        </View>
      </Card>

      <Card accent={palette.accent} style={{ backgroundColor: palette.surface }}>
        <Text style={styles.cardTitle}>Capacity</Text>
        <Text style={styles.cardDetail}>Turnaround: {provider.turnaroundDays} days</Text>
        <Text style={styles.cardDetail}>Max active orders: {provider.maxActiveOrders}</Text>
        <Text style={styles.cardDetail}>Queue slots: {provider.availability.maxQueueSize}</Text>
        <Button
          title="Edit capacity"
          variant="secondary"
          onPress={() => onQuickEdit('profile')}
        />
      </Card>

      <View>
        <SectionTitle>Printers</SectionTitle>
        {provider.printers.length === 0 ? (
          <Text style={styles.empty}>No printers have been added yet.</Text>
        ) : (
          provider.printers.map((printer) => (
            <Card key={printer.id} accent={palette.accent} style={{ backgroundColor: palette.surface }}>
              <View style={styles.orderTop}>
                <Text style={styles.cardTitle}>{printer.name}</Text>
                <Badge
                  label={printer.isActive ? 'Active' : 'Paused'}
                  tone={printer.isActive ? 'success' : 'neutral'}
                />
              </View>
              <Text style={styles.cardDetail}>{printer.modelName}</Text>
              <Text style={styles.cardDetail}>
                {printer.buildVolume.x} × {printer.buildVolume.y} × {printer.buildVolume.z} mm ·{' '}
                {printer.materials.join(', ')}
              </Text>
            </Card>
          ))
        )}
        <Button
          title="Add or edit printers"
          variant="secondary"
          onPress={() => onQuickEdit('printers')}
        />
      </View>

      <Card accent={palette.accent} style={{ backgroundColor: palette.surface }}>
        <Text style={styles.cardTitle}>Full provider setup</Text>
        <Text style={styles.cardDetail}>
          Use the wizard for material rates, agreements, and a complete review of your shop.
        </Text>
        <Button title="Open full setup" variant="ghost" onPress={onEditSetup} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.surfaceSubtle },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 16 },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  sectionGap: { gap: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerIdentity: { gap: 2 },
  headerBrand: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.success,
  },
  headerTitle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.bg },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: touchTarget,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modeButtonText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16.8, color: colors.bg },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageTitle: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 29, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  emptyState: { flex: 1, justifyContent: 'center', gap: 14, paddingHorizontal: 8 },

  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted },
  statValue: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 26.4, color: colors.text, ...tabularFigures },
  statDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted, ...tabularFigures },

  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.text },
  cardDetail: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.text },
  ordersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  link: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.link },
  empty: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  orderCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderNumber: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.muted, ...tabularFigures },
  orderPrice: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: colors.text, ...tabularFigures },
  orderTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.text },
  orderMeta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  orderStatus: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: colors.link },
  orderActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  declineButton: { width: 110, minHeight: touchTarget },
  acceptButton: { flex: 1, minHeight: touchTarget },
});
