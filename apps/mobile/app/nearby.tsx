import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AppHeader,
  BottomNavigation,
  Button,
  EmptyView,
  ErrorView,
  LoadingView,
  ModeBadge,
  Screen,
  SpecLabel,
  StatusPill,
  type BottomNavKey,
} from '../components/ui';
import { Icon, icons } from '../components/icons';
import { api } from '../lib/api';
import { fonts } from '../lib/fonts';
import { colors, radius, touchTarget } from '../lib/theme';
import type { Material, Printer } from '../lib/types';

const LOCATION = { lat: 13.8708, lng: 100.6053 };

const MATERIAL_FILTERS: ('ALL' | Material)[] = ['ALL', 'PLA', 'PETG', 'ABS', 'TPU'];

const CUSTOMER_ROUTES: Record<BottomNavKey, string> = {
  discover: '/',
  nearby: '/nearby',
  upload: '/upload',
  orders: '/orders',
  profile: '/profile',
};

export default function NearbyScreen() {
  const router = useRouter();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [search, setSearch] = useState('');
  const [material, setMaterial] = useState<'ALL' | Material>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await api.getPrinters({ ...LOCATION, sort: 'nearest' });
      setPrinters(result.printers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load nearby printers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return printers.filter((printer) => {
      const matchesQuery =
        !query ||
        printer.name.toLowerCase().includes(query) ||
        (printer.model_name ?? '').toLowerCase().includes(query);
      const matchesMaterial = material === 'ALL' || (printer.materials ?? []).includes(material);
      return matchesQuery && matchesMaterial;
    });
  }, [printers, search, material]);

  return (
    <Screen>
      <AppHeader back section="providers" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.modeRow}>
          <ModeBadge mode="customer" />
        </View>

        <View style={styles.intro}>
          <SpecLabel>NEARBY</SpecLabel>
          <Text style={styles.title}>Printers near you</Text>
          <Text style={styles.subtitle}>Bangkok, Thailand · {printers.length} available printers</Text>
        </View>

        <View style={styles.searchBox}>
          <Icon name={icons.search} size={19} color={colors.accent} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search a printer or machine"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Search nearby printers"
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="off"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <View style={styles.mapPanel} accessibilityLabel={`Map with ${visible.length} available printers`}>
          <View style={styles.mapGrid} />
          <SpecLabel>MAP · {visible.length} AVAILABLE PRINTERS</SpecLabel>
          {visible.slice(0, 8).map((printer, index) => (
            <Pressable
              key={printer.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${printer.name} on the map`}
              onPress={() => router.push(`/printer/${printer.id}` as never)}
              style={[
                styles.mapMarker,
                {
                  left: `${12 + ((index * 23) % 72)}%`,
                  top: `${28 + ((index * 17) % 42)}%`,
                },
              ]}
              hitSlop={8}
            >
              <Text style={styles.mapMarkerText}>{index + 1}</Text>
            </Pressable>
          ))}
          <View style={styles.mapCenter} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {MATERIAL_FILTERS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${option === 'ALL' ? 'all materials' : option}`}
              accessibilityState={{ selected: material === option }}
              onPress={() => setMaterial(option)}
              style={[
                styles.filterChip,
                material === option && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  material === option && styles.filterChipTextActive,
                ]}
              >
                {option === 'ALL' ? 'All' : option}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? (
          <ErrorView title="Could not load printers" message={error} onRetry={() => void load()} />
        ) : null}

        {loading ? (
          <LoadingView label="Finding printers nearby…" />
        ) : visible.length === 0 ? (
          <EmptyView
            title="No printers match"
            message="Try another material or clear the search to see every nearby maker."
            action={
              <Button
                title="Clear filters"
                size="sm"
                onPress={() => {
                  setSearch('');
                  setMaterial('ALL');
                }}
              />
            }
          />
        ) : (
          visible.map((printer) => (
            <Pressable
              key={printer.id}
              accessibilityRole="button"
              accessibilityLabel={`View ${printer.name}`}
              onPress={() => router.push(`/printer/${printer.id}` as never)}
              style={({ pressed }) => [styles.printerCard, pressed && styles.pressed]}
            >
              <View style={styles.printerIcon}>
                <Icon name={icons.printer} size={21} color={colors.accent} />
              </View>
              <View style={styles.printerCopy}>
                <Text style={styles.printerName} numberOfLines={1}>{printer.name}</Text>
                <Text style={styles.printerMeta} numberOfLines={1}>
                  {printer.model_name ?? 'FDM printer'} · {printer.printer_count} printer
                  {printer.printer_count === 1 ? '' : 's'}
                </Text>
                <Text style={styles.printerDistance}>
                  {printer.distance_km === null
                    ? 'Distance unavailable'
                    : `${printer.distance_km.toFixed(1)} km away`}
                </Text>
              </View>
              <StatusPill label="AVAILABLE" tone="done" />
            </Pressable>
          ))
        )}

        {visible.length > 0 ? (
          <Button
            title="View list"
            variant="secondary"
            onPress={() => router.push('/printers' as never)}
          />
        ) : null}
        <View style={{ height: 92 }} />
      </ScrollView>

      <View style={styles.navWrap}>
        <BottomNavigation
          active="nearby"
          onPress={(key) => router.navigate(CUSTOMER_ROUTES[key] as never)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  pressed: { opacity: 0.85 },
  modeRow: { alignItems: 'flex-end' },
  intro: { gap: 5 },
  title: { fontFamily: fonts.displayBold, fontSize: 27, lineHeight: 33, color: colors.text },
  subtitle: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 16, color: colors.muted },

  searchBox: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text, padding: 0 },

  mapPanel: {
    height: 190,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    overflow: 'hidden',
  },
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.35,
    backgroundColor: colors.surfaceSubtle,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mapMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    minWidth: touchTarget,
    minHeight: touchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapMarkerText: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.bg },
  mapCenter: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.bg,
    backgroundColor: colors.success,
    left: '50%',
    top: '50%',
    marginLeft: -6,
    marginTop: -6,
  },

  filterRow: { gap: 8 },
  filterChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterChipText: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  filterChipTextActive: { color: colors.bg },

  printerCard: {
    minHeight: 84,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  printerIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  printerCopy: { flex: 1, gap: 3 },
  printerName: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.text },
  printerMeta: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, color: colors.muted },
  printerDistance: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.accent },

  navWrap: { position: 'absolute', left: 16, right: 16, bottom: 12 },
});
