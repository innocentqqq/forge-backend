import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { api, estimatePrice } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { fonts } from '../lib/fonts';
import { colors, outlined, radius } from '../lib/theme';
import type { Material, Quality } from '../lib/types';

const SERVICE_FEE = 2;
const QUALITY_LABELS: Record<Quality, string> = { DRAFT: 'Draft · 0.2 mm', STANDARD: 'Standard · 0.15 mm', HIGH: 'High · 0.1 mm' };

type PaymentMethod = 'CASH_ON_PICKUP' | 'PROMPTPAY';

export default function CheckoutScreen() {
  const params = useLocalSearchParams<{
    modelId?: string;
    printerId?: string;
    fileName?: string;
    material?: string;
    quality?: string;
    color?: string;
    quantity?: string;
    infill?: string;
  }>();
  const router = useRouter();
  const [printerName, setPrinterName] = useState('Your selected provider');
  const [printerPlace, setPrinterPlace] = useState<string | null>(null);
  const [priceFactor, setPriceFactor] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>('PROMPTPAY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.printerId) return;
    api.getPrinter(params.printerId)
      .then((result) => {
        setPrinterName(result.printer.name);
        setPrinterPlace(result.printer.location_details);
        setPriceFactor(Number(result.printer.price_factor) || 1);
      })
      .catch(() => undefined);
  }, [params.printerId]);

  const quantity = Math.max(1, Number(params.quantity) || 1);
  const material = (params.material || 'PLA') as Material;
  const quality = (params.quality || 'STANDARD') as Quality;

  const printCost = useMemo(
    () => estimatePrice({ material, quality, quantity, priceFactor }),
    [material, quality, quantity, priceFactor],
  );
  const total = printCost + SERVICE_FEE;

  const place = async () => {
    if (!params.modelId || !params.printerId) {
      setError('Go back and select a 3D model and printer first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { order } = await api.createOrder({
        model_id: params.modelId,
        printer_id: params.printerId,
        material,
        quality,
        color: params.color,
        payment_method: payment,
        quantity,
        infill: Number(params.infill) || 20,
      });
      router.replace({
        pathname: '/order-confirmation' as never,
        params: {
          orderId: order.id,
          orderNumber: order.order_number,
          printer: order.printers?.name ?? printerName,
          eta: order.eta ? formatDate(order.eta) : '',
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not place order');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AppHeader back title="Checkout" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.fileName} numberOfLines={1}>
            {(params.fileName || 'Your model').replace(/\.(stl|3mf|obj)$/i, '')}
          </Text>
          <Text style={styles.provider}>
            {printerName}
            {printerPlace ? ` · ${printerPlace}` : ''}
          </Text>
          <View style={styles.dividerTop} />
          <Row label="Material" value={material} />
          <Row label="Color" value={params.color ?? 'White'} />
          <Row label="Quality" value={QUALITY_LABELS[quality]} />
          <Row label="Quantity" value={String(quantity)} last />
        </View>

        <View style={styles.card}>
          <Row label="Print cost" value={formatMoney(printCost)} />
          <Row label="Service fee" value={formatMoney(SERVICE_FEE)} />
          <Row label="Total" value={formatMoney(total)} emphasis last />
        </View>

        <Text style={styles.section}>Payment</Text>
        <View style={styles.card}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: payment === 'PROMPTPAY' }}
            onPress={() => setPayment('PROMPTPAY')}
            style={styles.paymentRow}
          >
            <View style={styles.cardIcon}>
              <Icon name={icons.card} size={18} color={colors.accent} />
            </View>
            <View style={styles.paymentBody}>
              <Text style={styles.paymentTitle}>Campus card</Text>
              <Text style={styles.paymentMeta}>•••• 4021</Text>
            </View>
            <View style={[styles.radio, payment !== 'PROMPTPAY' && styles.radioOff]}>
              {payment === 'PROMPTPAY' ? <Icon name={icons.check} size={12} color="#FFFFFF" /> : null}
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => Alert.alert('Add payment method', 'Card management is handled by your campus account.')}
            style={styles.addPayment}
          >
            <Text style={styles.addPaymentText}>+ Add payment method</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Place order" loading={busy} onPress={() => void place()} style={styles.placeButton} />
        <Text style={styles.terms}>By placing your order you agree to Forge’s Terms of Service.</Text>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, emphasis = false, last = false }: { label: string; value: string; emphasis?: boolean; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <Text style={emphasis ? styles.rowLabelStrong : styles.rowLabel}>{label}</Text>
      <Text style={emphasis ? styles.rowValueStrong : styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32, gap: 14 },
  section: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text, marginTop: 10, marginBottom: -4 },

  card: { ...outlined, padding: 16 },
  fileName: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  provider: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted, marginTop: 4 },
  dividerTop: { height: 1, backgroundColor: colors.hairline, marginTop: 14 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  rowValue: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.text, flexShrink: 1, textAlign: 'right' },
  rowLabelStrong: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.muted },
  rowValueStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },

  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  paymentBody: { flex: 1, gap: 2 },
  paymentTitle: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 18, color: colors.text },
  paymentMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted },
  radio: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  radioOff: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  addPayment: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.hairline },
  addPaymentText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.link },

  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 15.7, color: colors.danger },
  placeButton: { marginTop: 10 },
  terms: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted, textAlign: 'center' },
});
