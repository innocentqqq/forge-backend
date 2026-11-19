import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, ErrorView, LoadingView, Screen } from '../components/ui';
import { api, USE_MOCK_API } from '../lib/api';
import { formatMoney } from '../lib/format';
import { fonts } from '../lib/fonts';
import { colors, radius, shadow } from '../lib/theme';
import { MATERIALS, QUALITIES, type Material, type Quality, type Sort } from '../lib/types';
import type { ProviderResult } from '../lib/marketplace-types';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'nearest', label: 'Nearest' },
  { key: 'cheapest', label: 'Cheapest' },
  { key: 'fastest', label: 'Fastest' },
];

export default function ProvidersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    modelId?: string;
    fileName?: string;
    material?: string;
    quality?: string;
    color?: string;
    quantity?: string;
  }>();
  const modelId = params.modelId ?? '';
  const [material, setMaterial] = useState<Material>(
    MATERIALS.find((item) => item === params.material) ?? 'PLA',
  );
  const quality: Quality = QUALITIES.find((item) => item === params.quality) ?? 'STANDARD';
  const quantity = Math.max(1, Number.parseInt(params.quantity ?? '1', 10) || 1);
  const [providers, setProviders] = useState<ProviderResult[]>([]);
  const [sort, setSort] = useState<Sort>('nearest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!modelId) {
      setError('A model is required to find matching providers.');
      setLoading(false);
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setProviders(await api.getProviders({ modelId, material, sort }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load providers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [material, modelId, sort]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const selected = providers.find((provider) => provider.id === selectedId);
  const placeOrder = async () => {
    if (!selected || !selected.fits) return;
    setPlacing(true);
    setPlaceError('');
    try {
      const order = await api.createMarketplaceOrder({
        modelId,
        providerId: selected.id,
        material,
        quality,
        quantity,
        color: params.color,
      });
      if (USE_MOCK_API) {
        // Mock orders are accepted automatically and start printing, so the
        // customer lands directly on the 3D build preview.
        router.replace(`/order/${order.id}`);
      } else {
        router.replace({
          pathname: '/order-confirmation',
          params: {
            orderId: order.id,
            orderNumber: order.order_number,
            printer: selected.displayName,
            eta: order.eta ?? '',
          },
        });
      }
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : 'Could not place the order.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Screen>
      <AppHeader back />
      {loading && providers.length === 0 ? (
        <LoadingView label="Finding providers…" />
      ) : error && providers.length === 0 ? (
        <ErrorView message={error} onRetry={() => void load()} />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
          >
            <Text style={styles.title}>Choose a provider</Text>
            <View style={styles.sortRow}>
              {SORTS.map((option) => (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === option.key }}
                  onPress={() => setSort(option.key)}
                  style={[styles.chip, sort === option.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, sort === option.key && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.filterCard}>
              <Text style={styles.filterLabel}>Material</Text>
              <View style={styles.materialRow}>
                {MATERIALS.map((option) => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: option === material }}
                    onPress={() => setMaterial(option)}
                    style={[styles.material, option === material && styles.materialSelected]}
                  >
                    <Text style={[styles.materialText, option === material && styles.materialTextSelected]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {providers.map((provider) => {
              const isSelected = selectedId === provider.id;
              return (
                <Pressable
                  key={provider.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !provider.fits }}
                  disabled={!provider.fits}
                  onPress={() => setSelectedId(provider.id)}
                  style={[styles.card, isSelected && styles.cardSelected, !provider.fits && styles.cardDisabled]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.providerName}>{provider.displayName}</Text>
                    <Text style={styles.price}>{formatMoney(provider.estimate)}</Text>
                  </View>
                  <Text style={styles.meta}>
                    {provider.distanceKm === null ? 'Distance unavailable' : `${provider.distanceKm.toFixed(1)} km away`}
                    {' · '}
                    {provider.etaHours === null ? 'ETA unavailable' : `${provider.etaHours} hr estimate`}
                  </Text>
                  <Text style={styles.meta}>{provider.availability}</Text>
                  {!provider.fits ? (
                    <Text style={styles.doesNotFit}>
                      Model doesn’t fit this printer’s {provider.buildVolume.x} × {provider.buildVolume.y} × {provider.buildVolume.z} mm build volume.
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
            {!loading && providers.length === 0 ? (
              <Text style={styles.empty}>No providers are available for this model and material.</Text>
            ) : null}
            {placeError ? <Text accessibilityRole="alert" style={styles.error}>{placeError}</Text> : null}
            <View style={{ height: 100 }} />
          </ScrollView>
          <View style={styles.bottomBar}>
            <Button
              title={placing ? 'Placing order…' : selected?.fits ? 'Place order' : 'Select a provider'}
              loading={placing}
              disabled={!selected?.fits || placing}
              onPress={() => void placeOrder()}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 12 },
  title: { fontFamily: fonts.bold, fontSize: 22, color: colors.text },
  sortRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, minHeight: 36, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
  chipTextActive: { fontFamily: fonts.semibold, color: '#FFFFFF' },
  filterCard: { padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  filterLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  materialRow: { flexDirection: 'row', gap: 8 },
  material: { borderRadius: radius.sm, backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 6 },
  materialSelected: { backgroundColor: '#DDE5FF' },
  materialText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  materialTextSelected: { color: colors.text, fontFamily: fonts.bold },
  card: { padding: 14, gap: 7, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardSelected: { borderWidth: 2, borderColor: colors.accent },
  cardDisabled: { opacity: 0.8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  providerName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  doesNotFit: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 17, color: colors.danger },
  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.danger },
  empty: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingVertical: 14 },
  bottomBar: { position: 'absolute', left: 16, right: 16, bottom: 20, backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14 },
});
