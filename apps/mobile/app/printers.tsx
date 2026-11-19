import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Chip, LoadingView, Screen } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { ForgeMap } from '../components/ForgeMap';
import { useUserLocation } from '../lib/location';
import { api, estimatePrice } from '../lib/api';
import { formatMoney } from '../lib/format';
import { fonts } from '../lib/fonts';
import { colors, outlined, radius } from '../lib/theme';
import { MATERIALS, QUALITIES, type Material, type Printer, type Quality, type Sort } from '../lib/types';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'nearest', label: 'Nearest' },
  { key: 'cheapest', label: 'Cheapest' },
  { key: 'fastest', label: 'Fastest' },
];

export default function PrintersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string;
    modelId?: string;
    fileName?: string;
    material?: string;
    quality?: string;
    color?: string;
    quantity?: string;
    infill?: string;
  }>();

  const [items, setItems] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<Sort>('nearest');
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const userLocation = useUserLocation();

  const load = useCallback(async (refresh = false) => {
    if (!userLocation) return; // wait for the location answer (or fallback) first
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await api.getPrinters({ ...userLocation.coords, sort });
      setItems(result.printers);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sort, userLocation]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = items.filter((item) => !params.q || item.name.toLowerCase().includes(params.q.toLowerCase()));

  const material: Material = MATERIALS.includes(params.material as Material) ? (params.material as Material) : 'PLA';
  const quality: Quality = QUALITIES.includes(params.quality as Quality) ? (params.quality as Quality) : 'STANDARD';
  const quantity = Math.max(1, Number(params.quantity) || 1);
  const quote = (printer: Printer) =>
    estimatePrice({ material, quality, quantity, priceFactor: Number(printer.price_factor) || 1 });
  const selectedPrinter = filtered.find((printer) => printer.id === selected) ?? null;
  const fileLabel = params.fileName ? params.fileName.replace(/\.(stl|3mf|obj)$/i, '') : null;

  return (
    <Screen>
      <AppHeader back title="Choose printer" />
      <View style={styles.top}>
        <View style={styles.leadRow}>
          <Text style={styles.lead} numberOfLines={1}>
            {fileLabel ? `${fileLabel} · ${material} · ${quantity} pcs` : `${filtered.length} printers nearby`}
          </Text>
          <View style={styles.viewToggle}>
            {(['list', 'map'] as const).map((mode) => (
              <Pressable
                key={mode}
                accessibilityRole="button"
                accessibilityState={{ selected: view === mode }}
                onPress={() => setView(mode)}
                style={[styles.viewOption, view === mode && styles.viewOptionActive]}
              >
                <Icon name={mode === 'list' ? 'list-outline' : 'map-outline'} size={14} color={view === mode ? '#FFFFFF' : colors.text} />
                <Text style={[styles.viewOptionText, view === mode && styles.viewOptionTextActive]}>{mode === 'list' ? 'List' : 'Map'}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.filters}>
          {SORTS.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              active={sort === option.key}
              onPress={() => setSort(option.key)}
              style={styles.filter}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
      >
        {!loading && view === 'map' ? (
          <ForgeMap
            height={320}
            markers={filtered.map((printer) => ({
              id: printer.id,
              coords: { lat: Number(printer.lat), lng: Number(printer.lng) },
              title: printer.name,
              subtitle: printer.location_details ?? undefined,
            }))}
            selectedId={selected}
            onSelectMarker={setSelected}
            center={userLocation?.coords}
            showUserLocation={userLocation?.source === 'granted'}
          />
        ) : null}
        {!loading && view === 'map' && !selectedPrinter ? (
          <Text style={styles.mapHint}>Tap a pin to choose that printer.</Text>
        ) : null}

        {loading ? (
          <LoadingView label="Finding printers…" />
        ) : (
          (view === 'map' ? filtered.filter((printer) => printer.id === selected) : filtered).map((printer) => {
            const active = selected === printer.id;
            return (
              <Pressable
                key={printer.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(printer.id)}
                style={({ pressed }) => [styles.card, active && styles.cardActive, pressed && styles.pressed]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}>
                    <Icon name={icons.printer} size={20} color={active ? colors.accent : colors.text} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.name} numberOfLines={1}>
                      {printer.name}
                    </Text>
                    <View style={styles.metaRow}>
                      <Icon name={icons.pin} size={11} color={colors.muted} />
                      <Text style={styles.meta}>
                        {printer.printer_count} {printer.printer_count === 1 ? 'printer' : 'printers'} available ·{' '}
                        {printer.distance_km === null ? 'nearby' : `${printer.distance_km.toFixed(1)} km`}
                      </Text>
                    </View>
                    <Text style={styles.meta}>
                      Est. Completion : {Number(printer.est_completion_hours_per_unit).toFixed(0)} hrs
                    </Text>
                    {printer.location_details ? (
                      <Text style={styles.place} numberOfLines={1}>
                        {printer.location_details}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.price}>{formatMoney(quote(printer))}</Text>
                </View>
                {active ? <Text style={styles.selectedTag}>Selected</Text> : null}
              </Pressable>
            );
          })
        )}

        {!loading && filtered.length === 0 ? <Text style={styles.empty}>No printers found. Please check back soon.</Text> : null}
        {!loading && filtered.length > 0 ? (
          <Text style={styles.disclaimer}>
            Quotes include material and machine time. Your final price is confirmed by the printer.
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerLabel}>Total estimate</Text>
          <Text style={styles.footerPrice}>{selectedPrinter ? formatMoney(quote(selectedPrinter)) : '—'}</Text>
        </View>
        <Button
          title={selectedPrinter ? 'Continue to Checkout' : 'Select a printer'}
          disabled={!selectedPrinter}
          onPress={() =>
            selectedPrinter &&
            router.push({ pathname: '/checkout' as never, params: { ...params, printerId: selectedPrinter.id } })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  top: { paddingHorizontal: 24, paddingBottom: 8 },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  lead: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  viewToggle: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  viewOption: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30 },
  viewOptionActive: { backgroundColor: colors.accent },
  viewOptionText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 14.5, color: colors.text },
  viewOptionTextActive: { color: '#FFFFFF' },
  mapHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted, textAlign: 'center' },
  filters: { flexDirection: 'row', gap: 8, marginTop: 4 },
  filter: { flex: 1 },
  list: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18, gap: 12 },

  card: { ...outlined, padding: 14 },
  cardActive: { borderColor: colors.accent, backgroundColor: '#FBFCFF' },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted },
  place: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },
  price: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  selectedTag: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 13.3, color: colors.accent, marginTop: 10 },
  disclaimer: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 4 },
  empty: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, paddingVertical: 16 },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: '#EEF1F7',
    gap: 8,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  footerPrice: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
});
