import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, LoadingView, Screen } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { api } from '../lib/api';
import { fonts } from '../lib/fonts';
import { colors, radius, shadow } from '../lib/theme';
import type { Printer, Sort } from '../lib/types';

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

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await api.getPrinters({ lat: 13.8708, lng: 100.6053, sort });
      setItems(result.printers);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sort]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = items.filter((item) => !params.q || item.name.toLowerCase().includes(params.q.toLowerCase()));

  return (
    <Screen>
      <AppHeader back />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
      >
        <View style={styles.filters}>
          {SORTS.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setSort(option.key)}
              style={({ pressed }) => [styles.chip, sort === option.key && styles.chipActive, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, sort === option.key && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <LoadingView label="Finding printers…" />
        ) : (
          filtered.map((printer) => (
            <Pressable
              key={printer.id}
              onPress={() => setSelected(printer.id)}
              style={({ pressed }) => [styles.card, selected === printer.id && styles.cardSelected, pressed && styles.pressed]}
            >
              <View style={styles.iconWell}>
                <Icon name={icons.university} size={30} color={colors.text} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.name}>{printer.name}</Text>
                <Text style={styles.meta}>
                  {printer.printer_count} printers available • {printer.distance_km === null ? 'nearby' : `${printer.distance_km.toFixed(1)} km`}
                  {'\n'}Est. Completion : {Number(printer.est_completion_hours_per_unit).toFixed(0)} hrs
                </Text>
              </View>
            </Pressable>
          ))
        )}

        {!loading && filtered.length === 0 ? <Text style={styles.empty}>No printers found. Please check back soon.</Text> : null}
        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <Button
          title={selected ? 'Select printer' : 'Select a printer'}
          size="sm"
          labelSize="md"
          disabled={!selected}
          onPress={() =>
            selected &&
            router.push({ pathname: '/checkout' as never, params: { ...params, printerId: selected } })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 15, paddingTop: 16, paddingBottom: 24, gap: 12 },
  pressed: { opacity: 0.85 },

  filters: { flexDirection: 'row', gap: 19 },
  chip: {
    flex: 1,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.text },
  chipTextActive: { color: '#FFFFFF', fontFamily: fonts.semibold },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cardSelected: { borderWidth: 2, borderColor: colors.accent },
  iconWell: {
    width: 69,
    height: 69,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  cardCopy: { flex: 1, gap: 6 },
  name: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.text },

  empty: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, paddingVertical: 16 },

  bottomBar: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 20,
    height: 84,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 17,
  },
});
