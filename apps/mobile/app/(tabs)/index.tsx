import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
  Badge,
  Button,
  EmptyView,
  ErrorView,
  LoadingView,
  ModeBadge,
  Screen,
  SpecLabel,
  StatusPill,
  tabularFigures,
} from '../../components/ui';
import { Icon, icons } from '../../components/icons';
import { api } from '../../lib/api';
import { fonts } from '../../lib/fonts';
import { colors, radius, spacing } from '../../lib/theme';
import type { Printer } from '../../lib/types';

const LOCATION = { lat: 13.8708, lng: 100.6053 };

export default function HomeScreen() {
  const router = useRouter();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [search, setSearch] = useState('');
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

  const chooseDesign = () => router.push('/upload' as never);
  const visible = printers.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Screen>
      <AppHeader />
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
          <Text style={styles.greeting}>Good afternoon.</Text>
          <Text style={styles.headline}>Turn Your 3D Ideas{'\n'}Into Reality.</Text>
        </View>

        <View style={styles.searchBox}>
          <Icon name={icons.search} size={20} color={colors.accent} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search printers, materials, models"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Search printers and materials"
            autoCorrect={false}
            autoCapitalize="none"
            autoComplete="off"
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => router.push('/nearby' as never)}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload a 3D model"
          onPress={chooseDesign}
          style={({ pressed }) => [styles.uploadCard, pressed && styles.pressed]}
        >
          <View style={styles.uploadIcon}><Icon name={icons.plus} size={28} color={colors.accent} /></View>
          <View style={styles.uploadCopy}>
            <Text style={styles.uploadTitle}>Upload</Text>
            <Text style={styles.uploadMeta}>STL, OBJ or 3MF · up to 50 MB</Text>
          </View>
          <Icon name={icons.chevronRight} size={18} color={colors.muted} />
        </Pressable>

        <View style={styles.featured}>
          <View style={styles.featuredTop}>
            <SpecLabel>FEATURED MODEL</SpecLabel>
            <StatusPill label="AVAILABLE" tone="done" />
          </View>
          <Text style={styles.modelName}>Lamp Shade v4.stl</Text>
          <Text style={styles.modelSpec}>PLA · Standard · Validated</Text>
          <View style={styles.specs}>
            <View style={styles.spec}><Text style={styles.specValue}>150</Text><Text style={styles.specLabel}>X MM</Text></View>
            <View style={styles.spec}><Text style={styles.specValue}>150</Text><Text style={styles.specLabel}>Y MM</Text></View>
            <View style={styles.spec}><Text style={styles.specValue}>92</Text><Text style={styles.specLabel}>Z MM</Text></View>
          </View>
          <Button title="Configure print" size="sm" labelSize="md" onPress={() => router.push('/print-settings' as never)} />
        </View>

        <View style={styles.materialRow}>
          <Badge label="PLA" tone="success" />
          <Badge label="PETG" />
          <Badge label="Standard" />
        </View>

        {error ? (
          <ErrorView title="Could not load printers" message={error} onRetry={() => void load()} />
        ) : null}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Nearby printers</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="See nearby printers"
            onPress={() => router.push('/nearby' as never)}
            hitSlop={spacing.sm}
          >
            <Text style={styles.seeAll}>View list</Text>
          </Pressable>
        </View>

        {loading ? (
          <LoadingView label="Finding nearby printers…" />
        ) : (
          visible.slice(0, 4).map((printer) => (
            <Pressable
              key={printer.id}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${printer.name}`}
              onPress={() => router.push(`/printer/${printer.id}` as never)}
              style={({ pressed }) => [styles.printerCard, pressed && styles.pressed]}
            >
              <View style={styles.printerIcon}>
                <Icon name={icons.university} size={20} color={colors.accent} />
              </View>
              <View style={styles.printerDetails}>
                <Text style={styles.printerName}>{printer.name}</Text>
                <Text style={styles.printerMeta}>
                  {printer.distance_km !== null ? `${printer.distance_km.toFixed(1)} km away` : 'Nearby'}
                  {' · '}{printer.printer_count} printers
                </Text>
              </View>
              <StatusPill label="AVAILABLE" tone="done" />
            </Pressable>
          ))
        )}

        {!loading && visible.length === 0 ? (
          <EmptyView
            title="No matching printers"
            message="Try a different search, or upload a model to see makers that can print it."
            action={<Button title="Upload a model" onPress={chooseDesign} />}
          />
        ) : null}
        <View style={{ height: 96 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 16 },
  pressed: { opacity: 0.85 },
  modeRow: { alignItems: 'flex-end' },
  intro: { gap: 6 },
  greeting: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.muted },
  headline: { fontFamily: fonts.displayBold, fontSize: 28, lineHeight: 34, color: colors.text },

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

  uploadCard: {
    minHeight: 74,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  uploadIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  uploadCopy: { flex: 1, gap: 3 },
  uploadTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, color: colors.text },
  uploadMeta: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, color: colors.muted },

  featured: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, gap: 10 },
  featuredTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modelName: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, color: colors.text },
  modelSpec: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17, color: colors.muted },
  specs: { flexDirection: 'row', gap: 8 },
  spec: { flex: 1, borderRadius: radius.sm, backgroundColor: colors.surfaceSubtle, padding: 10, gap: 2 },
  specValue: { fontFamily: fonts.monoBold, fontSize: 16, lineHeight: 20, color: colors.text, ...tabularFigures },
  specLabel: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, color: colors.muted },

  materialRow: { flexDirection: 'row', gap: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, color: colors.text },
  seeAll: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.accent },

  printerCard: {
    minHeight: 74,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  printerIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  printerDetails: { flex: 1, gap: 4 },
  printerName: { fontFamily: fonts.display, fontSize: 15, lineHeight: 20, color: colors.text },
  printerMeta: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 15, color: colors.muted },
});
