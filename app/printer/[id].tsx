import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  Banner,
  Button,
  Card,
  Chip,
  Divider,
  ErrorView,
  Label,
  LoadingView,
  PageTitle,
  Screen,
  TextField,
} from '../../components/ui';
import { api, estimatePrice } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { fonts } from '../../lib/fonts';
import { colors, radius, shadow } from '../../lib/theme';
import { MATERIALS, QUALITIES, type Material, type Printer, type Quality } from '../../lib/types';

export default function PrinterDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [printer, setPrinter] = useState<Printer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modelId, setModelId] = useState('');
  const [material, setMaterial] = useState<Material>('PLA');
  const [quality, setQuality] = useState<Quality>('STANDARD');
  const [infill, setInfill] = useState('20');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setPrinter((await api.getPrinter(id)).printer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load printer');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const quantityNumber = Math.max(1, Number.parseInt(quantity, 10) || 1);
  const estimated = useMemo(() => {
    if (!printer) return 0;
    return estimatePrice({
      material,
      quality,
      quantity: quantityNumber,
      priceFactor: Number(printer.price_factor),
    });
  }, [printer, material, quality, quantityNumber]);

  const submit = async () => {
    if (!printer) return;
    setSubmitError(null);

    if (!modelId.trim()) {
      setSubmitError('Enter the model file ID you want to print.');
      return;
    }

    setSubmitting(true);
    try {
      const { order } = await api.createOrder({
        model_id: modelId.trim(),
        printer_id: printer.id,
        material,
        quality,
        infill: Number.parseInt(infill, 10) || 20,
        quantity: quantityNumber,
      });
      router.push(`/order/${order.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <AppHeader back />
        <LoadingView label="Loading printer…" />
      </Screen>
    );
  }

  if (error || !printer) {
    return (
      <Screen>
        <AppHeader back />
        <ErrorView message={error ?? 'Printer not found'} onRetry={() => void load()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <PageTitle>{printer.name}</PageTitle>
        <Text style={styles.location}>{printer.location_details ?? 'Pickup details unavailable'}</Text>

        <View style={styles.summary}>
          <Stat label="Distance" value={printer.distance_km !== null ? `${printer.distance_km.toFixed(1)} km` : '—'} />
          <Stat label="ETA" value={`${Number(printer.est_completion_hours_per_unit).toFixed(1)} h`} />
          <Stat label="Printers" value={String(printer.printer_count)} />
        </View>

        {printer.contact_info?.phone || printer.contact_info?.email ? (
          <Card>
            <Text style={styles.cardTitle}>Contact</Text>
            {printer.contact_info?.phone ? <Text style={styles.contactLine}>{printer.contact_info.phone}</Text> : null}
            {printer.contact_info?.email ? <Text style={styles.contactLine}>{printer.contact_info.email}</Text> : null}
          </Card>
        ) : null}

        <Card>
          <Text style={styles.cardTitle}>New order</Text>

          <TextField
            label="Model file ID"
            value={modelId}
            onChangeText={setModelId}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="00000000-0000-0000-0000-000000000000"
            hint="UUID of an uploaded model file."
          />

          <View style={styles.field}>
            <Label>Material</Label>
            <View style={styles.chips}>
              {MATERIALS.map((option) => (
                <Chip key={option} label={option} active={material === option} onPress={() => setMaterial(option)} />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Label>Quality</Label>
            <View style={styles.chips}>
              {QUALITIES.map((option) => (
                <Chip
                  key={option}
                  label={option[0] + option.slice(1).toLowerCase()}
                  active={quality === option}
                  onPress={() => setQuality(option)}
                />
              ))}
            </View>
          </View>

          <View style={styles.split}>
            <View style={styles.flex}>
              <TextField label="Infill %" value={infill} onChangeText={setInfill} keyboardType="number-pad" />
            </View>
            <View style={styles.flex}>
              <TextField label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
            </View>
          </View>

          <Divider />

          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Estimated total</Text>
            <Text style={styles.estimateValue}>{formatMoney(estimated)}</Text>
          </View>

          {submitError ? <Banner message={submitError} /> : null}

          <Button title="Place order" onPress={() => void submit()} loading={submitting} />
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 16 },
  location: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted, marginTop: -8 },

  summary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    ...shadow.card,
  },
  stat: { flex: 1, gap: 2 },
  statValue: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  statLabel: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },

  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  contactLine: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },

  field: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  split: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },

  estimateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  estimateLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  estimateValue: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29, color: colors.text },
});
