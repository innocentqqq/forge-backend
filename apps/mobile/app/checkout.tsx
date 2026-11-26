import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Radio, Screen, SectionHero, tabularFigures } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { api, estimatePrice } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { fonts } from '../lib/fonts';
import { colors, radius, sectionPalettes, touchTarget } from '../lib/theme';
import type { Material, Quality } from '../lib/types';

const palette = sectionPalettes.checkout;
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
  const [priceFactor, setPriceFactor] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>('PROMPTPAY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.printerId) return;
    api.getPrinter(params.printerId)
      .then((result) => {
        setPrinterName(result.printer.name);
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
      <AppHeader back section="checkout" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHero
          section="checkout"
          title="Checkout"
          subtitle="Review your print and confirm payment."
        />

        <View style={styles.card}>
          <View style={styles.fileRow}>
            <Icon name={icons.box} size={26} color={palette.accent} />
            <Text
              style={styles.fileName}
              numberOfLines={2}
              accessibilityLabel={params.fileName || printerName}
            >
              {params.fileName || printerName}
            </Text>
          </View>
          <Row label="Material" value={material} />
          <Row label="Color" value={params.color ?? 'White'} />
          <Row label="Quality" value={QUALITY_LABELS[quality]} />
          <Row label="Quantity" value={String(quantity)} />
        </View>

        <View style={styles.priceCard}>
          <Row label="Print cost" value={formatMoney(printCost)} />
          <Row label="Service fee" value={formatMoney(SERVICE_FEE)} />
          <Row label="Total" value={formatMoney(total)} emphasis />
        </View>

        <Text style={styles.section}>Payment</Text>

        <View style={styles.card}>
          <Pressable
            accessibilityRole="radio"
            accessibilityLabel="Campus card ending in 4021"
            accessibilityState={{ selected: payment === 'PROMPTPAY' }}
            onPress={() => setPayment('PROMPTPAY')}
            style={styles.paymentRow}
          >
            <View style={styles.paymentLeft}>
              <Radio selected={payment === 'PROMPTPAY'} />
              <Text style={styles.paymentTitle}>Campus card</Text>
            </View>
            <Text style={styles.paymentHint}>•••• 4021</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add payment method"
            onPress={() => Alert.alert('Add payment method', 'Card management is handled by your campus account.')}
            style={styles.paymentRow}
          >
            <View style={styles.paymentLeft}>
              <Radio selected={false} />
              <Text style={styles.paymentLink}>Add payment method</Text>
            </View>
          </Pressable>
        </View>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <Button title="Place order" loading={busy} onPress={() => void place()} />
        <Text style={styles.terms}>By placing your order you agree to Forge’s Terms of Service.</Text>
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={emphasis ? styles.rowLabelStrong : styles.rowLabel}>{label}</Text>
      <Text style={emphasis ? styles.rowValueStrong : styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 16 },
  section: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20.8, color: palette.ink },

  card: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileName: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.text },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowLabel: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted },
  rowValue: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.text, ...tabularFigures },
  rowLabelStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.text },
  rowValueStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: palette.accent, ...tabularFigures },

  priceCard: {
    backgroundColor: palette.soft,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
  },

  paymentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: touchTarget },
  paymentLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentTitle: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20.8, color: colors.text },
  paymentLink: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18.2, color: palette.accent },
  paymentHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.muted, ...tabularFigures },
  divider: { height: 1, backgroundColor: colors.surfaceSubtle },

  error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18.2, color: colors.danger },
  terms: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16.8, color: colors.muted, textAlign: 'center' },
});
