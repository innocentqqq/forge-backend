import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Screen } from '../components/ui';
import { Icon, icons } from '../components/icons';
import { estimatePrice } from '../lib/api';
import { formatMoney } from '../lib/format';
import { fonts } from '../lib/fonts';
import { colors, outlined, radius } from '../lib/theme';
import { MATERIALS, QUALITIES, type Material, type Quality } from '../lib/types';

const COLORS = [
  { name: 'White', hex: '#FFFFFF', border: '#0066FF' },
  { name: 'Black', hex: '#000000', border: '#000000' },
  { name: 'Blue', hex: '#5261FF', border: '#5261FF' },
  { name: 'Red', hex: '#FF0000', border: '#FF0000' },
  { name: 'Green', hex: '#00CE1F', border: '#00CE1F' },
  { name: 'Orange', hex: '#FF7700', border: '#FF7700' },
  { name: 'Purple', hex: '#9500F9', border: '#9500F9' },
];

const QUALITY_COPY: Record<Quality, { title: string; layers: string }> = {
  DRAFT: { title: 'Draft', layers: '0.2mm Layers' },
  STANDARD: { title: 'Standard', layers: '0.15mm Layers' },
  HIGH: { title: 'High', layers: '0.1mm Layers' },
};

const MATERIAL_RATES: Record<Material, string> = {
  PLA: '฿0.05/cm³',
  ABS: '฿0.07/cm³',
  PETG: '฿0.08/cm³',
  TPU: '฿0.12/cm³',
};

export default function PrintSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ modelId?: string; fileName?: string }>();
  const [material, setMaterial] = useState<Material>('PLA');
  const [quality, setQuality] = useState<Quality>('STANDARD');
  const [color, setColor] = useState('White');
  const [quantity, setQuantity] = useState(1);

  const estimated = useMemo(
    () => estimatePrice({ material, quality, quantity, priceFactor: 1 }),
    [material, quality, quantity],
  );

  return (
    <Screen>
      <AppHeader back title="Print Settings" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.fileCard}>
          <View style={styles.thumb}>
            <Icon name={icons.box} size={26} color={colors.accent} />
          </View>
          <View style={styles.fileBody}>
            <Text style={styles.fileName} numberOfLines={1}>
              {(params.fileName ?? 'Example Object').replace(/\.(stl|3mf|obj)$/i, '')}
            </Text>
            <Text style={styles.fileMeta}>Size: 85 × 60 × 45 mm{'\n'}Volume: 28.5 cm³</Text>
          </View>
        </View>

        <Text style={styles.section}>Material</Text>
        <View style={styles.row}>
          {MATERIALS.map((option) => {
            const selected = material === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setMaterial(option)}
                style={({ pressed }) => [styles.material, selected && styles.materialSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.materialName, selected && styles.onPrimary]}>{option}</Text>
                <Text style={[styles.materialRate, selected && styles.onPrimarySoft]}>{MATERIAL_RATES[option]}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Color</Text>
        <View style={styles.colorRow}>
          {COLORS.map((option) => {
            const selected = color === option.name;
            const light = option.name === 'White';
            return (
              <Pressable
                key={option.name}
                accessibilityRole="button"
                accessibilityLabel={option.name}
                accessibilityState={{ selected }}
                onPress={() => setColor(option.name)}
                style={[styles.swatchRing, selected && styles.swatchRingOn]}
              >
                <View style={[styles.swatch, { backgroundColor: option.hex }, light && styles.swatchWhite]}>
                  {selected ? <Icon name={icons.check} size={14} color={light ? colors.text : '#FFFFFF'} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.selectedColor}>{color}</Text>

        <Text style={styles.section}>Quality</Text>
        <View style={styles.row}>
          {QUALITIES.map((option) => {
            const selected = quality === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setQuality(option)}
                style={({ pressed }) => [styles.quality, selected && styles.qualitySelected, pressed && styles.pressed]}
              >
                <Text style={[styles.qualityName, selected && styles.qualitySelectedText]}>{QUALITY_COPY[option].title}</Text>
                <Text style={[styles.qualityLayer, selected && styles.qualitySelectedText]}>{QUALITY_COPY[option].layers}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Quantity</Text>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <Icon name={icons.minus} size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.qty}>{quantity}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            onPress={() => setQuantity((q) => Math.min(20, q + 1))}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <Icon name={icons.plus} size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.stepHint}>× {MATERIAL_RATES[material].replace('/cm³', '')} per cm³</Text>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Estimated Price</Text>
          <Text style={styles.price}>{formatMoney(estimated)}</Text>
          <Text style={styles.priceNote}>Final quote comes from the printer you choose.</Text>
        </View>

        <Button
          title="Find Nearby Printers"
          onPress={() =>
            router.push({
              pathname: '/printers' as never,
              params: {
                modelId: params.modelId ?? '',
                fileName: params.fileName ?? '',
                material,
                quality,
                color,
                quantity: String(quantity),
                infill: '20',
              },
            })
          }
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32 },
  pressed: { opacity: 0.85 },
  section: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text, marginTop: 24, marginBottom: 10 },

  fileCard: { ...outlined, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  thumb: { width: 62, height: 62, borderRadius: radius.sm, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  fileBody: { flex: 1, gap: 4 },
  fileName: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  fileMeta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },

  row: { flexDirection: 'row', gap: 8 },
  material: { flex: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, paddingVertical: 12, alignItems: 'center', gap: 4 },
  materialSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  materialName: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text },
  materialRate: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },
  onPrimary: { color: '#FFFFFF' },
  onPrimarySoft: { color: 'rgba(255,255,255,0.85)' },

  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  swatchRing: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatchRingOn: { borderColor: colors.accent },
  swatch: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  swatchWhite: { borderWidth: 1, borderColor: colors.border },
  selectedColor: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted, marginTop: 8 },

  quality: { flex: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingVertical: 12, alignItems: 'center', gap: 4 },
  qualitySelected: { backgroundColor: colors.surfaceSubtle, borderColor: colors.accent },
  qualityName: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 18, color: colors.text },
  qualityLayer: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted },
  qualitySelectedText: { color: colors.link },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 8 },
  stepButton: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center' },
  qty: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 19.4, color: colors.text, minWidth: 26, textAlign: 'center' },
  stepHint: { marginLeft: 'auto', fontFamily: fonts.regular, fontSize: 11, lineHeight: 13.3, color: colors.muted, paddingRight: 4 },

  priceCard: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 16, marginTop: 24, marginBottom: 14 },
  priceLabel: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15.7, color: colors.text },
  price: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 31, color: colors.text, marginTop: 2 },
  priceNote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 14.5, color: colors.muted, marginTop: 2 },
});
